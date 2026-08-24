# Gameplay — Afterimages (rémanence de sprite)

> Statut : **en cours d'implémentation** (branche `feat/app-08-player-dash`).
> Portée : `@atlasjs/gameplay` (composant + système ECS) + `apps/dino-brawl` (dash du joueur, validation).
> Contexte : réalise [`RENDER-19`](../backlog/RENDER-19-afterimage-renderer.md), ouvert comme suite naturelle de [`trails.md`](trails.md) §10. **Ce n'est pas un trail** : pas de ruban continu, pas de courbe de largeur le long d'un chemin. C'est une feature voisine et distincte, à ne pas confondre avec `TrailRenderer`.
> Consommateur de validation : [`APP-08`](../backlog/APP-08-player-dash.md), le dash du joueur de dino-brawl.

---

## 1. Objectif et périmètre

Estamper derrière une entité des copies fanées de son propre sprite — le look de dash le plus répandu en pixel-art. On pose le composant, on allume `emitting`, l'entité laisse des fantômes qui s'éteignent.

Contraintes directrices :

- **Aucune primitive de rendu nouvelle.** Pas de nœud nebula supplémentaire, pas de shader, pas de mécanisme de batching : voir §2.
- **Zéro allocation par frame** dans le chemin de rendu, et zéro allocation par image estampée : les emplacements d'instantanés et les nœuds sont pré-alloués et recyclés.
- **Survivre à la mort de l'émetteur.** Une entité éphémère (projectile) doit pouvoir mourir en laissant ses images s'éteindre proprement, comme un trail.
- **Ne rien exiger de plus que ce que porte déjà une entité qui s'affiche** : un `SpriteRender` et un `WorldTransform2D`.

Hors périmètre (YAGNI) : rémanence d'autre chose qu'un sprite (tilemap, trail, formes), déformation ou étirement des copies, décalage spatial additionnel, courbe d'échelle le long de la traînée, blend configurable par composant (les images passent par le chemin sprite, donc son blend).

## 2. Insight central : l'instantané est déjà une instance de sprite

Une image rémanente est exactement ce que `SpriteRenderSystem` sait déjà dessiner : un quad texturé, avec un pivot, une source rect, une transformation et un tint. La seule différence est que ses valeurs sont **gelées dans le passé** au lieu d'être lues sur l'entité vivante.

> Une image rémanente n'est pas un nouvel objet de rendu. C'est **un `SpriteNode` de plus**, dont on a figé la transformation et la source rect au moment de l'estampe, et dont on baisse le tint avec l'âge.

Conséquences directes, et c'est tout l'intérêt de ce design :

- **`nebula` ne bouge pas.** Aucun `AfterimageNode`, aucun WGSL, aucun `NodeRenderer`. Le composant et le système vivent entièrement dans `@atlasjs/gameplay`.
- Les images profitent **gratuitement** du batch instancié des sprites, du blend `alpha` déjà en place, du sampler `nearest` et du tri par couches.
- Le fade est un `setTint()`, pas une passe de post-traitement.

Le prix à payer est que le ring buffer d'instantanés vit dans le système gameplay et non dans un nœud nebula — asymétrique avec `TrailNode`, qui possède le sien. C'est un choix assumé : `TrailNode` possède son buffer parce qu'il en **dérive une géométrie** (les normales miter) ; ici il n'y a aucune géométrie à dériver, le buffer n'est qu'une file d'états de sprite.

## 3. Composant `AfterimageRenderer`

Fichier : `packages/gameplay/src/components/AfterimageRenderer.ts`. Vocabulaire calqué sur `TrailRenderer` — mêmes noms pour les mêmes rôles, y compris le canal `command`.

```ts
export type AfterimageRendererCommand = "none" | "clear";

export interface AfterimageRendererOptions {
  interval?: number;
  minDistance?: number;
  time?: number;
  startColor?: Color;
  endColor?: Color;
  emitting?: boolean;
  maxImages?: number;
  visible?: boolean;
  sortingLayer?: string;
  sortingOrder?: number;
}

export class AfterimageRenderer {
  public interval: number;
  public minDistance: number;
  public time: number;
  public startColor: Color;
  public endColor: Color;
  public emitting: boolean;
  public maxImages: number;
  public visible: boolean;
  public sortingLayer: string;
  public sortingOrder: number;
  public command: AfterimageRendererCommand;

  public constructor(options?: AfterimageRendererOptions);
  public clear(): this;
}
```

| Champ | Défaut | Rôle |
| --- | --- | --- |
| `interval` | `0.05` | Secondes entre deux estampes. |
| `minDistance` | `0` | L'estampe est repoussée tant que l'entité ne s'est pas éloignée d'autant de la précédente. `0` désactive la garde. |
| `time` | `0.25` | Durée de vie d'une image, en secondes. |
| `startColor` | `Color(1, 1, 1, 0.5)` | Tint d'une image qui vient d'être estampée. |
| `endColor` | `Color(1, 1, 1, 0)` | Tint d'une image en fin de vie. |
| `emitting` | `true` | Estampe-t-on ? Passer à `false` n'efface pas les images déjà posées : elles finissent de s'éteindre. |
| `maxImages` | `16` | Capacité du ring buffer. Une estampe au-delà écrase la plus ancienne. |
| `visible` | `true` | Masque toutes les images sans rien effacer. |
| `sortingLayer` | `"Default"` | Couche de tri, appliquée à chaque image. |
| `sortingOrder` | `0` | Ordre dans la couche, appliqué à chaque image. |

Règles de sémantique, à couvrir par des tests :

- **`clear()`** pose `command = "clear"` et rend `this`. Le système efface toutes les images vivantes puis remet `command = "none"`, exactement comme `TrailRenderer.clear()`.
- **Front montant de `emitting`** (`false` → `true`) : le système vide le buffer avant d'estamper. Un dash ne doit jamais afficher les fantômes du dash précédent — c'est le défaut que RENDER-23 a corrigé sur les trails, et il se transpose tel quel.
- **`interval <= 0`** estampe à chaque frame. **`time <= 0`** ne garde aucune image (elles naissent expirées).
- **`maxImages`** est tronqué à l'entier et borné dans `[1, 64]` par le système. La borne haute existe parce que `maxImages` **dimensionne** le pool de nœuds et le buffer : c'est le critère qui a fait garder le clamp de `capacity` sur `TrailNode` et rejeter celui de `smoothing`.

## 4. Système `AfterimageRenderSystem`

Fichier : `packages/gameplay/src/systems/AfterimageRenderSystem.ts`. Même squelette que `TrailRenderSystem` : `SparseSet<Mounted…>` indexé par entité, liste `detached` pour les émetteurs morts, `clear()` global au dispose du plugin.

### 4.1 Structures

```ts
interface AfterimageSlot {
  sprite: Sprite;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  age: number;
}

interface MountedAfterimages {
  slots: AfterimageSlot[];
  nodes: (SpriteNode | null)[];
  count: number;
  head: number;
  sinceLastStamp: number;
  lastStampX: number;
  lastStampY: number;
  hasLastStamp: boolean;
  emitting: boolean;
}
```

`slots` est un ring buffer de `maxImages` entrées **pré-allouées** ; `nodes` est un pool parallèle de la même taille, chaque nœud monté paresseusement à la première utilisation de son emplacement. Un instantané ne contient que des nombres plus une référence de `Sprite` : aucune allocation à l'estampe.

### 4.2 Boucle de mise à jour

La requête est `world.query(WorldTransform2D, SpriteRender, AfterimageRenderer)` : sans `SpriteRender`, il n'y a rien à estamper.

Par entité, dans cet ordre :

1. **Résoudre le monté**, en redimensionnant `slots`/`nodes` si `maxImages` a changé (un redimensionnement vide le buffer — c'est un changement de capacité, pas un état à préserver).
2. **Front montant de `emitting`** → vider le buffer.
3. **`command === "clear"`** → vider le buffer, remettre `command = "none"`.
4. **Estamper**, si `emitting` : `sinceLastStamp += dt` ; si `sinceLastStamp >= interval` **et** (aucune estampe précédente **ou** distance à la dernière estampe `>= minDistance`), écrire un instantané à `head`, remettre `sinceLastStamp` à `0` et mémoriser la position d'estampe. Si la garde de distance bloque, **`sinceLastStamp` n'est pas remis à zéro** : l'estampe part dès que l'entité bouge assez, sans rafale de rattrapage.
   L'instantané fige la position, la rotation et l'échelle **monde**, avec `flipX`/`flipY` déjà repliés en signe de l'échelle — le même calcul que `SpriteRenderSystem` — plus la référence de `Sprite` courante, qui porte la texture, le pivot et la source rect (donc la frame d'animation du moment).
5. **Vieillir puis expirer** : `age += dt` sur toutes les images vivantes, et retirer par la queue celles dont `age >= time`. La queue est le plus ancien élément du ring, donc l'expiration est monotone et se fait en avançant un index.
6. **Dessiner** : pour chaque image vivante, `t = age / time`, tint = interpolation linéaire composante par composante de `startColor` vers `endColor`. Le tint **remplace** celui du `SpriteRender` source, il ne le multiplie pas. Le nœud reçoit position, rotation, échelle et source rect figées, `setVisible(renderer.visible)`, puis `applySortFields(node, layers, renderer.sortingLayer, renderer.sortingOrder, image.y)` — **la position Y de l'image**, pas celle de l'émetteur, de sorte qu'une image estampée plus bas se trie devant celles du dessus.
7. **Masquer** les nœuds du pool qui ne portent aucune image vivante (`setVisible(false)`), sans les démonter : le prochain dash les réutilise.

Un nœud est (re)créé quand son emplacement change de texture, comme le fait `SpriteRenderSystem.resolveNode` — `SpriteNode` reçoit sa texture à la construction.

### 4.3 Cycle de vie

- `detach(entity)` retire le monté du `SparseSet` et le pousse dans `detached`. Les images détachées continuent de vieillir et de s'afficher, puis leurs nœuds sont retirés du graphe quand la dernière expire. Aucune estampe nouvelle sur un détaché.
- `clear()` retire immédiatement tous les nœuds détachés du graphe, appelé au dispose du plugin.

### 4.4 Enregistrement dans `GameplayPlugin`

Strictement le même câblage que `trailRenderSystem`, décalé d'un cran :

- construction avec `(nebula, sortingLayers)`, champ privé `afterimageRenderSystem?` sur le plugin pour le `clear()` du dispose ;
- `defineComponent(AfterimageRenderer)` ;
- `world.onRemove(AfterimageRenderer, (entity) => afterimageRenderSystem.detach(entity))` dans `registerCleanup` ;
- `registerSystem(render, world, …, { name: "gameplay:afterimage-render", stage: "PreRender", after: "gameplay:trail-render" })`.

## 5. Le dash du joueur (`APP-08`)

Consommateur de validation, dans `apps/dino-brawl`. Le détail de gameplay vit dans son ticket ; ce qui suit est ce que le design impose.

- **Clip `dash`** dans `DinoSheet` : la frame `11` seule, `fps: 1`, `loop: false` — même forme que `pre_sprint`.
- **Touche** : `dash: button().keys(Key.Shift)` dans `controls.ts`. `Space` est pris par `boost`, `MouseLeft` par `SwordScript`.
- **`PlayerDashScript`** possède le dash de bout en bout : lecture de l'action, cooldown, direction, déplacement, woosh, et pilotage de `AfterimageRenderer.emitting`. Il expose `isDashing`.
- **Arbitrage** : il n'existe aujourd'hui **aucun** arbitrage entre les scripts du joueur — `PlayerMovementScript`, `PlayerAnimationScript` et `HurtReactionScript` lisent l'input et déplacent le personnage chacun de leur côté. `PlayerDashScript` est donc injecté **en prop** dans `PlayerMovementScript` (qui saute son `move()` pendant un dash) et `PlayerAnimationScript` (qui joue `dash`), sur le pattern déjà en place pour `hurtbox: HurtboxScript` et `hitbox: SwordHitboxScript`.
- **Ordre d'attache** : `PlayerDashScript` est attaché **avant** les deux autres dans `PlayerPrefab`. `ScriptManager` itère ses records dans l'ordre d'insertion (`Map` + ids incrémentaux), donc l'ordre d'attache garantit un `isDashing` frais dans la même frame.
- **Le knockback reste hors arbitrage** : `HurtReactionScript.advanceKnockback` continuera de s'ajouter au déplacement de dash, comme il s'ajoute déjà à la marche. Un arbitrage général du déplacement serait un `MovementLock` moteur — c'est une abstraction partagée qui mérite son propre ticket, pas un passager du dash.
- **Point d'accroche i-frames** : `HurtboxScript` gagne un `grantInvincibility(duration)` public, et `PlayerDashScript` une prop optionnelle `hurtbox?: HurtboxScript`. Rien n'est branché aujourd'hui : le joueur n'a pas de hurtbox et aucun ennemi ne frappe. Voir [`APP-09`](../backlog/APP-09-dash-iframes.md).

## 6. Performance

- **Par frame et par émetteur** : un parcours des images vivantes, un `setTint`/`setPosition`/`setScale`/`setSourceRect` par image, plus le `applySortFields` que paie déjà chaque sprite. Aucune allocation : slots et nœuds sont pré-alloués, l'interpolation de couleur écrit dans le nœud sans construire de `Color`.
- **Coût GPU** : `maxImages` instances de plus au maximum dans le batch sprite existant, sur la même texture que l'émetteur — donc dans le même batch, sans changement de pipeline. Aux réglages du dash (5 images), c'est 5 quads.
- **Coût à l'arrêt** : un émetteur avec `emitting = false` et zéro image vivante fait un parcours de requête et rien d'autre. Les nœuds du pool restent montés mais invisibles.
- Non mesuré : le surcoût d'un émetteur à `maxImages = 64`, raisonné mais pas chiffré.

## 7. Tests et validation

Tests unitaires (vitest, `packages/gameplay/test/`), sur le mode d'emploi des tests de `TrailRenderSystem` :

| Ce qui est vérifié | Pourquoi |
| --- | --- |
| Défauts du composant, valeur par valeur | Un défaut non testé peut être changé sans que rien ne casse (défaut appris sur RENDER-23 : `?? 3` n'était couvert nulle part). |
| `clear()` pose la commande et rend `this` | Contrat du canal `command`. |
| Cadence : `interval` respecté, pas d'estampe avant | Le cœur de la feature. |
| Garde `minDistance` : pas d'estampe sans déplacement, et **pas de rafale** de rattrapage au redémarrage | Le point subtil de §4.2 étape 4. |
| Front montant de `emitting` vide le buffer | Le défaut trails transposé. |
| Expiration à `age >= time`, et ordre d'expiration | La queue du ring. |
| Interpolation du tint aux bornes (`t = 0`, `t = 1`) et au milieu | Le fade est la sortie visible. |
| Écrasement de la plus ancienne à `maxImages` atteint | Le ring boucle. |
| `maxImages` tronqué et borné, y compris `0`, négatif, `1e6` | Une borne haute manquante a figé un onglet sur RENDER-23. |
| Tri sur la Y de l'image, pas celle de l'émetteur | §4.2 étape 6, invisible sans test. |
| `detach` : les images continuent de vieillir puis les nœuds sont retirés | Le projectile qui meurt. |
| `flipX`/`flipY` repliés dans l'échelle de l'instantané | Sinon les fantômes regardent à l'envers. |

Tests unitaires côté app (`apps/dino-brawl/test/`) : cooldown, direction capturée puis verrouillée, repli sur `flipX` sans input, distance parcourue sur la durée, `emitting` allumé puis éteint, `isDashing`, et l'octroi d'invincibilité quand une `hurtbox` est fournie.

Validation navigateur (skill `atlas-verify-webgpu`) : le dash dans `apps/dino-brawl`, images rémanentes visibles et distinctes, fade jusqu'à disparition, aucun fantôme résiduel au dash suivant, orientation correcte en dash vers la gauche, et console propre.

## 8. Découpage de livraison

Le plan d'exécution vit dans [`../plans/player-dash-afterimages.md`](../plans/player-dash-afterimages.md) et est transitoire.

1. Tickets et ce document.
2. `AfterimageRenderer` + `AfterimageRenderSystem` + enregistrement plugin, en TDD.
3. `HurtboxScript.grantInvincibility()`.
4. Clip `dash`, binding `Shift`, `PlayerDashScript`, en TDD.
5. Câblage `PlayerPrefab` / `PlayerMovementScript` / `PlayerAnimationScript`.
6. Vérification navigateur et réglage du look.

## 9. Suites naturelles (hors périmètre)

- **Arbitrage du déplacement** (`MovementLock` ou équivalent) : le knockback, le dash et un futur stun se disputent `character.move()` sans se voir.
- **I-frames réelles** ([`APP-09`](../backlog/APP-09-dash-iframes.md)), qui demandent d'abord un vecteur de dégâts vers le joueur.
- **Rémanence sur les ennemis et les projectiles** : le composant est générique, seul le câblage manque.
- **Décalage et échelle le long de la traînée**, pour des looks moins littéraux qu'une copie exacte.
