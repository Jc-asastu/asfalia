# Asfalia — contexto del proyecto

*Proof of Solvency that expires.* Hack Buenos Aires, 7-8 agosto 2026, Beginner Track.

`asfalia`: en la administración sumeria, el inspector recaudador — el funcionario que verificaba
lo declarado. El auditor, literal.

---

## Qué construimos

Una entidad (exchange, fintech, tesorería) demuestra que **sus activos cubren sus pasivos sin
revelar un solo número**. El auditor ve un veredicto — SOLVENTE / NO SOLVENTE — y nada más.

**El diferencial: el certificado vence.** No es un sello eterno. "Solvente al bloque N, caduca
en X". Pasada la ventana, la misma prueba criptográficamente válida es rechazada por vieja.
Todo proof-of-reserves nace viejo; este es el único que lo admite.

---

## Arquitectura — qué es privado y qué es público

Midnight separa estado público (on-chain) de estado privado (*witnesses*, off-chain, en la
máquina del que prueba). Compact compila a circuitos ZK.

**Privado (witness, nunca sale de la máquina del prover):**
- La lista de balances de activos
- La lista de balances de pasivos
- Cualquier agregado intermedio

**Público (ledger, on-chain):**
- El veredicto: solvente sí/no
- El momento del attest
- Los commitments de los datos privados

**Nada más cruza esa línea.** Si un número aparece en el ledger, en un log o en la UI, es un bug.

### Patrón witness-commitment (el filo del proyecto)

Los witnesses **no** están verificados criptográficamente: el prover puede pasar lo que quiera.
Por eso **el circuito nunca confía en un valor crudo**. Todo dato privado que importa se ata a un
*commitment* que el circuito verifica. Sin esto, la prueba no prueba nada.

### Fuente de tiempo — SPIKE RESUELTO (2026-08-07)

La standard library de Compact expone **comparaciones** contra el tiempo de bloque:

```compact
blockTimeLt(x)   blockTimeLte(x)   blockTimeGt(x)   blockTimeGte(x)
```

Son comparaciones, **no** un lector: no se puede traer el tiempo a una variable, solo preguntar
si está antes o después de un valor. Alcanza y sobra para la capa de frescura.
**No hace falta el plan B del heartbeat.**

El argumento necesita `disclose()` — el compilador lo exige porque el límite que comparás
revela una cota del tiempo:

```compact
fresh = blockTimeLt(disclose(deadline));
```

---

## Restricciones — no negociables

1. **Todo commit compila.** Contrato que no compila = descalificación automática. Nunca se deja
   el repo roto.
2. **Los witnesses jamás tocan el ledger, los logs ni la UI.** Solo veredicto + timestamp +
   commitments.
3. **Repo público, label `midnightntwrk`, licencia Apache 2.0** desde el primer commit.
4. **Nunca escribir claves privadas, mnemonics ni secretos a disco.** Van por variable de entorno.
5. Ante ambigüedad de diseño no listada como decisión abierta: **frenar y preguntar, no asumir.**
6. **Nunca reclamar "somos los primeros"** en el pitch ni en el README. El claim verificable es
   que Midnight lo pidió por escrito y que lo que falta es la versión abierta con vencimiento.

---

## Dónde se compila — IMPORTANTE

**La notebook de JC no puede compilar ni generar pruebas.** CPU Intel i5-2435M (Sandy Bridge,
2011): no tiene la instrucción `mulx` (BMI2). `zkir` y el proof server la usan sin ruta
alternativa (blst compilado sin dispatch de CPU en runtime) y crashean con SIGILL
(`trap invalid opcode` en `mul_mont_sparse_256`).

No es configuración. No hay paquete ni permiso que lo arregle.

**Se compila y se prueba en el GitHub Codespace de este repo.** La notebook queda de terminal.

---

## Orden de hitos

| # | Hito | Cuándo |
|---|---|---|
| 1 | Scaffold + context-pack | Día 1, 10-11h |
| 2 | Circuito core de solvencia | Día 1, mañana |
| 4 | Wiring end-to-end (CLI + pantalla auditor) | Día 1, tarde |
| — | **CHECKPOINT SAGRADO: demo end-to-end, aunque feo** | Día 1, noche |
| 3 | Suite de tests | Día 2 temprano |
| 5 | Capa de frescura | Día 2 mediodía, solo si el core cerró |
| 6 | Momento adversarial + demo | Día 2 mañana |

**Cada hito cerrado se commitea funcionando antes de abrir el siguiente.**

Escalera de extras, solo si el core cerró y en este orden: tests completos → Merkle de pasivos
con prueba de inclusión → renovación en vivo → reloj de cuenta regresiva → dos entidades lado
a lado.

---

## Lo que NO se hace

- No feed de datos en vivo. No oráculo real. No multi-activo. No UI de diseño.
- No framework pesado en la UI: un estado grande y legible, y un botón "revelar datos" que
  muestra vacío por diseño.
- No agregar alcance después del checkpoint sagrado. Si no llegó, se corta.

---

## Stack verificado (2026-08-07)

- Compact compiler **0.31.1** (`compact compile`) — sin build para Windows
- `@midnight-ntwrk/midnight-js-*` **4.1.1**, compact-runtime **0.16.0**
- Node **22.23.2**
- Proof server: Docker `midnightntwrk/proof-server`, puerto **6300**
- Redes: `undeployed` (devnet local, default) · `preview` (la del hackathon) · `preprod`
- Template base: `create-mn-app` 0.5.0, `hello-world` — el único con `--network` nativo
- `reference/bboard`: clon de `example-bboard` solo para consultar el patrón de wiring.
  **No se commitea, no se copia y pega a ciegas.**
