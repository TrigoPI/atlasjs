---
id: NETWORK-02
status: vision
domain: network
source: "[[state-sync]]"
effort: M
verified: 2026-09-06
---

# Encodage binaire et snapshots différentiels

Le fil est en JSON : 624 octets par snapshot à 8 joueurs, dont ~200 de clés, soit 12,5 ko/s
par client et ~100 ko/s en sortie serveur. Reste à passer en binaire, et à n'envoyer que les
deltas — ce dernier point demande une baseline par client et une boucle d'ack fiable.

**Accroche :** tout passe déjà par `encodeServer` / `decodeServer` dans `src/net/codec.ts`,
et rien de JSON ne fuit chez les appelants : le binaire est un changement d'un seul fichier.
Le codec est un point fixe vérifié (`encode(decode(encode(m))) === encode(m)`) sur 500
snapshots aléatoires graînés — c'est le test à faire passer par la nouvelle implémentation.
