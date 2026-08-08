# Asfalia — guion técnico del demo

El principio rector: **nada en vivo que tarde más de 30 segundos.** El attest tarda
75-90 s — por eso el heartbeat es el protagonista: cuando arranca el pitch, el grid
ya cuenta toda la historia solo. Lo único que se dispara en vivo es el settle
(rápido); la privacidad la muestra el explorador oficial (Transfer 0 tokens).

## Parámetros

| | Demo | Producción |
|---|---|---|
| Cadencia del heartbeat | 120 s | 86400 s (diaria) |
| Ventana de vigencia | 300 s | 30 días (GENIUS Act) |

La vigencia se fija al desplegar: `ASFALIA_TOL=300 ASFALIA_VALIDITY=300 npm run setup`.
Arranque posterior: `ASFALIA_HEARTBEAT_SEC=120 npm run api` (con
`ASFALIA_OWNER_SECRET` disponible en el entorno).

## Pre-pitch — la coreografía del grid (empieza T-12 min)

El objetivo: llegar al pitch con un grid que tenga **los tres colores**.

- **T-12 a T-6**: sistema latiendo normal → 3-4 celdas VERDES.
- **T-6**: matar la API 1 ciclo (`Ctrl+C`, esperar ~2.5 min, relevantar) → un
  hueco ORO punteado en el grid. *"La entidad eligió no probar."*
- **T-4** (con la API de nuevo arriba): en Tesorería, inflar un saldo de cliente
  (ej: Client BTC ×100) → el próximo latido emite **NO SOLVENTE** → celda ROJA.
- **T-2**: restaurar el saldo → el latido siguiente vuelve VERDE y deja el
  certificado vigente para el momento settle del pitch.
- **T-0**: pestaña **Historial** abierta, idioma según jurado (toggle EN·ES).

Verificar antes de subir: countdown "next in Xs" corriendo, última celda verde,
certificado VIGENTE en la pestaña auditor.

## El pitch — 90 segundos, click por click

**[0:00–0:20] — el problema, sobre el grid (pestaña Historial)**
> "Cuando cayó FTX la única respuesta era 'confiá en mí' o abrir los libros.
> Esto es un mes de solvencia comprimido en una pantalla: cada celda es un
> certificado ZK on-chain. Verde: probó. Rojo: mintió — y la matemática lo dijo.
> Oro: **eligió no probar. El silencio, registrado.**"

Señalar el pulso: "se emite solo, cada N — la entidad no puede olvidarse, solo
puede desenchufarlo. Y desenchufarlo deja marca."

**[0:20–0:40] — el certificado (click pestaña Certificado)**
> "Esto ve el auditor: SOLVENTE, verificado en cadena, y **vence** — acá, en vivo,
> la cuenta regresiva. Todo proof-of-reserves nace viejo; el nuestro caduca por
> circuito."

Click **Aceptar certificado** (settle en vivo, tarda ~20-30 s — sigue hablando):
> "Ahí una contraparte lo está aceptando on-chain. Si estuviera vencido, la cadena
> rechaza la transacción. No es una regla de UI: es un assert en el circuito."

**[0:40–0:55] — privacidad (pestaña Scanner → click en una fila → explorador)**
> "¿Y los números? No me crean a mí: esta es la transacción en el explorador
> oficial de Midnight. **Transfer 0 tokens.** No viajó un token, no viajó un
> número — viajó una prueba." (Tener la pestaña del explorador pre-abierta.)

(El settle strip ya habrá impreso ✓ aceptado — señalarlo al pasar.)

**[0:55–1:15] — completitud (click pestaña Portal, elegir una cuenta)**
> "¿Y cómo sé que no escondieron pasivos? No me lo dice la entidad: me lo dice el
> árbol. Cada cliente verifica que SU saldo está contado, contra la raíz Merkle
> on-chain, sin ver el de nadie más." → verificación verde en pantalla.

**[1:15–1:30] — cierre (volver a Historial)**
> "Circle attesta mensual porque la ley se lo exige. OKX publica ZK mensual. Lo que
> nadie shippeó es esto: el lado que **rechaza** pruebas viejas y el latido que
> convierte la solvencia de una foto en un pulso. Asfalia — proof of solvency that
> expires. Construida acá, en 27 horas."

## Q&A — armas cargadas

Ver `research-case.md`. Los tres golpes en una línea:
1. "¿Tecnología faltante?" → OKX ya usa zk-STARK mensual; falta el lado que rechaza y la cadencia barata. Eso somos.
2. "¿Por qué no chequear a cada momento?" → todos quieren; el vencimiento es lo que OBLIGA a probar a cada momento.
3. "¿Día 5 mueve fondos?" → exposición ≤ ventana, ventana precificada por contraparte. TLS: la industria acortó certificados, no los abandonó.

## Plan B (si el wifi o la devnet mueren en el peor momento)

El grid, el acta, el portal y el historial **ya renderizan estado acumulado** — con
la API caída, la última pantalla queda en pie. Tener capturas de respaldo de:
grid con 3 colores · acta SOLVENTE vigente · acta con VENCIDO en oro · acta NO
SOLVENTE · portal verde · settle rechazado por vencido. Carpeta `docs/shots/`.

Si nada corre: el pitch entero se hace sobre capturas con la misma narrativa.
Un demo honesto sobre estados preparados vale más que uno colgado.

## Reset entre corridas

```bash
# restaurar libro solvente (si quedo editado)
git checkout -- data/demo-users.json data/demo-entity.json
# limpiar historial para re-armar la coreografia
rm -f data/attest-log.json
# reiniciar el latido
ASFALIA_HEARTBEAT_SEC=120 npm run api
```

## Criterio de aceptación (HITO 6)

- [ ] Ciclo completo corrido 3 veces seguidas sin fallar, cronometrado ≤ 90 s
- [ ] Capturas de respaldo tomadas y en `docs/shots/`
- [ ] Ensayado con el toggle EN (jurado mixto)
