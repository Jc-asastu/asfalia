# Asfalia — deck (esqueleto slide por slide)

Estética: la del producto — negro #0a0a0a, oro #c4a84f, Spectral para títulos,
IBM Plex Mono para datos. Cada slide una idea. Máximo 8 slides + backup.

---

## 1 · Portada
**ASFALIA** (oro, espaciado) — *Proof of Solvency that expires.*
Subtítulo: Private solvency certification on Midnight · Hack Buenos Aires 2026.
Visual: el sello del acta (SVG del producto).

## 2 · El problema
> "Cuando cayó FTX, la única respuesta posible era 'confiá en mí' — o abrir los
> libros enteros. Una no prueba nada; la otra expone todo."
Y el detalle que nadie ataca: **toda prueba de reservas nace vieja.** Foto
mensual, fe los otros 29 días. El PDF viejo circula para siempre.

## 3 · La solución (captura: acta SOLVENTE vigente)
La entidad prueba que activos ≥ pasivos **sin revelar un número**.
El auditor ve: veredicto + vencimiento + commitments. Nada más existe.
Y el certificado **vence por circuito**: `settle()` rechaza la tx si expiró.

## 4 · El latido (captura: grid 3 colores — LA slide)
Emisión automática, renovación solapada, log donde cada celda apunta a su tx.
- Verde: probó · Rojo: mintió — la matemática lo dijo · **Oro: eligió no probar**
- "El silencio, registrado."
De la foto mensual al pulso continuo. Este es el diferencial.

## 5 · Completitud (captura: portal verde)
Merkle de cuentas construido DENTRO del circuito: la suma del veredicto y la
raíz publicada salen de las mismas hojas. Cada cliente verifica su inclusión
sin ver a nadie más. Esconder una cuenta = la verificación de ese cliente falla.

## 6 · Por qué ahora (los cuatro datos)
1. Prompt oficial del hackathon: compliance sin exponer datos. Fit textual.
2. RFS de Midnight pide "proof of solvency con ZK" por escrito.
3. Bullish (operador de nodo) lo anunció para sí; no hay versión abierta.
4. **GENIUS Act (EEUU)**: cadencia mensual obligatoria + firma penal del CFO.
   La regulación inventó nuestra ventana de vencimiento.

## 7 · Mercado (la slide de BizDev, ya pensada)
Cliente primario: exchanges/custodios medianos LATAM (presión CNV/BCB post-FTX).
Secundarios: stablecoins, tesorerías DAO. Canal: auditoras (white-label).
Modelo: open-core Apache 2.0 — se monetiza la operación (attestation continua
como servicio). **Verificar es gratis siempre. El vencimiento crea la recurrencia.**
Ancla: informe de auditor = decenas de miles/trimestre y es una foto.
Suscripción Asfalia = cientos-miles/mes y es un pulso.

## 8 · Cierre
Todo esto corre hoy: contrato Compact (2 circuitos), pruebas ZK reales, devnet,
19 tests, dashboard trilingüe de producto. Apache 2.0.
> "El certificado no promete el futuro — promete un pasado con fecha de
> vencimiento. Todos los demás prometen lo mismo, sin la fecha."
**Asfalia. Construida acá, en 27 horas.**

---

## Backup slides (solo Q&A)
- B1: Arquitectura dual-ledger (diagrama del README)
- B2: Las 3 respuestas duras (research-case.md): OKX ya usa ZK / el vencimiento
  obliga a probar / analogía TLS
- B3: Límites honestos: el gap del oráculo, qué atestigua el auditor
- B4: Roadmap: challenge circuit, ventanas por contraparte, testnet Preview
