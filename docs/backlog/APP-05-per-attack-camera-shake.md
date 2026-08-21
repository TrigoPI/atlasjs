---
id: APP-05
status: todo
domain: app
source: "[[weapon-attack-cues]]"
effort: S
verified: 2026-08-21
---

# `shake` par attaque dans le combo

`knockback` et `hitstop` sont désormais surchargeables par attaque, mais `shake` est resté sur `SwordScript` : les trois maillons du combo rapière secouent la caméra identiquement, y compris la fente finisher qui frappe pourtant deux fois plus fort. Reste à exposer un `shake?: ShakeSpec` optionnel sur `WeaponAttack`, à le forwarder par `AttackChain` et à le lire dans `SwordScript` avec repli sur sa propre valeur.

**Accroche :** le chemin complet existe déjà pour `knockback`/`hitstop` — champ protégé exposé, getter public `impact*`, forwarding par `getCurrentAttack()`, repli nullish côté `SwordScript`. Il n'y a qu'à le dupliquer pour un troisième canal.
