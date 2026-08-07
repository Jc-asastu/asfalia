# Modelo de negocio — Asfalia

*Investigación de mercado y recomendación comercial. Agosto 2026.*

Asfalia es "proof of solvency that expires": una entidad (exchange, fintech, emisor de
stablecoin, tesorería DAO) prueba con ZK que sus activos cubren sus pasivos sin revelar
números. El certificado **vence on-chain** y se renueva automáticamente por un daemon 24/7
("heartbeat"), con pruebas de inclusión Merkle para que cada cliente final verifique que su
saldo está contado. Motor open-core, Apache 2.0, sobre Midnight Network.

---

## 1. Competidores y comparables

### 1.1 Proof-of-Reserves / solvencia — jugadores activos

| Actor | Qué hace | Modelo de negocio | Pricing público | Fuente |
|---|---|---|---|---|
| **Proven** (startup, 2023) | ZK proof of solvency (Proof of Reserves + Proof of Liabilities combinados) vía zk-SNARK, publicado on-chain en Ethereum. Cliente ancla: **Bitso**, con reportes mensuales de solvencia descargables desde el perfil del usuario; la tech soporta correrse a diario. | B2B directo a exchanges/emisores/custodios, sin pricing público. Levantó **$15.8M seed** liderado por Framework Ventures. | No publicado | [CoinDesk](https://www.coindesk.com/business/2023/03/09/zero-knowledge-crypto-startup-proven-raises-158m-in-seed-round), [BusinessWire](https://www.businesswire.com/news/home/20230309005190/en/Proven-a-Zero-Knowledge-Proof-of-Solvency-Solution-for-Crypto-Raises-15.8M-Seed-Round-Led-by-Framework-Ventures), [Bitso Blog](https://blog.bitso.com/zero-knowledge-proof-to-show-solvency/), [Bitso Help Center](https://support.bitso.com/hc/en-us/articles/11193181182100-What-is-Proof-of-Solvency) |
| **Hacken** (PoR Audit) | Auditoría externa de fondos on-chain + pasivos con árbol de Merkle. Cliente ancla: **Bybit**, con PoR mensual desde junio 2024. | Servicio de auditoría bajo cotización ("request a quote"), no SaaS. | No publicado (custom quote) | [Hacken PoR Audit](https://hacken.io/services/proof-of-reserves-audit/), [Bybit PoR case study](https://hacken.io/case-studies/bybit-proof-of-reserves/) |
| **The Network Firm** | Firma contable especializada en crypto (la más grande de EE.UU. en el nicho). Ofrece 3 productos: *Conventional PoR* (primer reporte en 2-3 semanas, siguientes en 3-5 días), *Merkle Tree PoR* (primer reporte 3-4 semanas), y **Real-Time Reserves**: atestación firmada por CPA **actualizada cada 30 segundos**, para emisores de stablecoins y ETPs. | Engagement de atestación tradicional (AT-C / AICPA), integración estándar de 6 semanas. | No publicado | [The Network Firm — Real-Time Reserves](https://www.thenetworkfirm.com/real-time-reserves-for-crypto-blockchain-auditing-the-network-firm), [PoR overview](https://www.thenetworkfirm.com/proof-of-reserves-for-crypto-blockchain-auditing) |
| **LedgerLens** | Tooling SaaS para auditores/contadores: verificación on-chain en 20+ chains, Merkle Tree PoR, "Real-Time PoR" (lo venden como "cámara de seguridad 24/7 en vez de revisar una vez al mes"). | **SaaS con tiers públicos** — el comparable más directo a Asfalia en estructura de pricing. | **Starter: $199/mes** (trial 7 días, 16% desc. anual, queries limitadas). **Enterprise: a medida** (todos los módulos PoR, SOC 1/2 docs, soporte prioritario). Pay-as-you-go extra: $199 / 5,000 tokens de consulta. | [LedgerLens Pricing](https://ledgerlens.io/pricing), [2025 Review](https://ledgerlens.io/2025-review-changing-crypto-auditing) |
| **Space and Time** | zkPoR vía "Proof of SQL": ZK proofs sobre queries SQL para probar integridad de reservas y NAV, indexando 20+ chains. Infra tipo oráculo/coprocesador ZK, no un producto de atestación per se. | Enterprise/infra, sin pricing público; se vende como plataforma de datos verificables (indexación + prueba), no como servicio de auditoría en sí. | No publicado | [Space and Time — Trustless PoR](https://www.spaceandtime.io/trustless-proof-of-reserves) |
| **Chainlink Proof of Reserve** | Feeds oraculares que reportan reservas on-chain (deviation threshold o heartbeat), consumibles por smart contracts para colateral automático. Es infraestructura de *datos*, no una atestación de solvencia con pasivos incluidos. | Pago en cripto/fiat convertido a LINK vía "Payment Abstraction"; contratos enterprise a medida, sin tarifa pública por feed. | No publicado | [Chainlink — Proof of Reserve](https://chain.link/proof-of-reserve), [Chainlink blog](https://blog.chain.link/largest-proof-of-reserve-provider/) |
| **Binance zkmerkle-proof-of-solvency** | Herramienta open-source de Binance para su propio PoR (Merkle + ZK). Uso interno, no se licencia ni se vende a terceros. | No comercial | — | [GitHub — binance/zkmerkle-proof-of-solvency](https://github.com/binance/zkmerkle-proof-of-solvency) |

**Hallazgo clave:** el comparable más cercano a Asfalia en *concepto* es **Proven** (ZK, prueba
combinada de activos+pasivos, cliente real en LATAM vía Bitso) — pero Proven no tiene
mecanismo de **vencimiento/recurrencia forzada** (heartbeat que expira el certificado), que es
la cuña diferencial de Asfalia. El comparable más cercano en *estructura de pricing SaaS* es
**LedgerLens** (tiers públicos, entrada barata, upsell a enterprise).

### 1.2 Cadenas de privacidad (Aleo, Aztec, Mina)

No se encontró ningún protocolo de "proof of solvency" dedicado construido sobre Aleo, Aztec
o Mina. Hay abundante material técnico sobre zk-SNARKs/privacidad general en esas chains, pero
ningún producto equivalente a Asfalia. Esto es una señal de **espacio en blanco competitivo**:
Midnight (y las otras L1 de privacidad) no tienen todavía un jugador de PoR/solvencia nativo.

Fuentes: [búsqueda general Aleo/Aztec/Mina privacidad](https://www.gate.com/learn/articles/introduction-to-the-aleo-privacy-blockchain/4656) — sin resultados de un producto de solvencia dedicado en ninguna de las tres.

### 1.3 Tendencia de la industria: de snapshot a continuo

Múltiples fuentes (LedgerLens, The Network Firm, coverage general) coinciden en que la
industria se está moviendo de atestaciones puntuales (mensuales/trimestrales) a verificación
**continua/tiempo real** — exactamente la tesis de Asfalia con el heartbeat. Cita relevante:
"la próxima evolución de Proof of Reserves apunta a sistemas continuos y en tiempo real que
reemplacen los snapshots periódicos". Fuente: [LedgerLens 2025 Review](https://ledgerlens.io/2025-review-changing-crypto-auditing).

---

## 2. Precios ancla del mundo tradicional

### 2.1 Auditoría / atestación de reservas (tradicional)

| Servicio | Rango de costo | Frecuencia típica | Fuente |
|---|---|---|---|
| Atestación de PoR (custodios/exchanges, alcance variable) | **$50,000 – $500,000+/año**, escala con AUM y complejidad de custodia | Mensual/trimestral (más frecuencia = más costo) | [Onchain Finance Institute](https://www.onchainfinanceinstitute.com/articles/proof-of-reserves-for-stablecoin-issuers) |
| SOC 2 Type I | $5,000 – $20,000 (punto en el tiempo) | Anual | [SOC2Auditors.org](https://soc2auditors.org/soc-2-audit-cost/), [Sprinto](https://sprinto.com/blog/soc-2-compliance-cost/) |
| SOC 2 Type II | $20,000 – $50,000 (+ $5,000–$25,000 de "readiness" previa) | Anual, con ventana de observación de meses | [Drata — SOC 2 cost](https://drata.com/learn/soc-2/cost) |
| Atestación mensual USDC (Circle) | No publicado; firmas involucradas: Grant Thornton (reciente) y Deloitte en distintos momentos | **Mensual** | [Blockworks](https://blockworks.com/news/circle-taps-deloitte-as-new-auditor-doubles-down-on-proof-of-reserves) |
| Atestación trimestral USDT (Tether) | No publicado; BDO Italia desde 2021 | **Trimestral** | [The Block — Mazars](https://www.theblock.co/post/193935/skepticism-mazars-crypto-exchange) |

**Nota regulatoria (tailwind para Asfalia):** bajo **MiCA** (UE), los emisores de stablecoins
están *obligados por ley* a publicar atestaciones periódicas de reservas (mensual o trimestral
según clasificación/significancia), con supervisión de la EBA para tokens significativos. Esto
convierte la recurrencia de Asfalia (certificado que vence y se renueva) en un *requisito legal
que ya existe*, no algo que hay que evangelizar. Fuente: [Scorechain — MiCA stablecoin regulation](https://www.scorechain.com/blog/eu-stablecoin-regulation-mica), [Eco — MiCA 2026 update](https://eco.com/support/en/articles/14814632-mica-stablecoin-regulation-2026-update).

### 2.2 SaaS de compliance continuo (el mejor análogo de "compliance como suscripción")

| Producto | Rango anual publicado | Estructura | Fuente |
|---|---|---|---|
| **Vanta** | $10,000 (Essential) – $80,000 (Pro/Enterprise); típico $12,000–$40,000 según headcount/frameworks | Plataforma de automatización; **la auditoría en sí es aparte** ($10k–$50k adicional a un auditor independiente) | [Sprinto — Vanta pricing](https://sprinto.com/blog/vanta-pricing/), [Spendflo](https://www.spendflo.com/blog/comprehensive-guide-to-vanta-pricing) |
| **Drata** | $7,500 – $100,000; típico SaaS $15,000–$25,000; mid-size (50-200 empleados) $20,000–$45,000 | Tiers por features/automatización; auditor externo aparte | [Vendr — Drata](https://www.vendr.com/marketplace/drata), [Costbench](https://costbench.com/software/compliance-management/drata/) |
| **Secureframe** | $7,500 – $70,000+; promedio real pagado ~$20,000/año (Vendr, 16 empresas) | Fundamentals (1 framework) → Complete (multi-framework, SSO/SCIM) | [Vendr — Secureframe](https://www.vendr.com/marketplace/secureframe) |

**Patrón consistente en los 3:** el "engine"/plataforma se vende por suscripción anual
($10k–$45k para el grueso del mercado SMB/mid-market), y el **trabajo de certificación real lo
hace un tercero aparte** (el auditor). Esto es directamente análogo a la separación que
Asfalia puede ofrecer: **motor open-source + operación gestionada por suscripción**, sin
pretender reemplazar a la auditora sino ser la capa continua entre auditorías.

### 2.3 Comparable SaaS específico de PoR (no compliance genérico)

**LedgerLens** (sección 1.1) es el único con pricing público en el nicho exacto: entrada
$199/mes, sube a "custom" para el módulo real-time/enterprise. Confirma que hay apetito de
mercado para un tier de entrada barato (self-serve) con upsell a contratos custom para el
segmento institucional — mismo patrón que Vanta/Drata pero a un décimo del ticket, porque
LedgerLens vende *tooling para auditores*, no la atestación en sí.

---

## 3. Modelo para Asfalia

### 3.1 A quién se cobra

**El que prueba paga. La verificación es siempre gratis** — igual que Chainlink PoR (el
consumidor del feed no paga por leerlo) y que The Network Firm (el cliente final de un
exchange no paga para chequear su Merkle proof). Cobrar por verificar mataría el efecto de
red: cuantos más usuarios finales verifiquen gratis, más presión competitiva sobre la entidad
que sí paga por probar solvencia.

**Tiers de cliente pagador:**

| Tier | Perfil | Por qué paga |
|---|---|---|
| **DAO / tesorería** | Tesorería DAO, fondo cripto chico, protocolo DeFi | Transparencia ante su propia comunidad/gobernanza sin exponer posiciones a copy-trading |
| **Exchange mediano LATAM** | Exchange/fintech regional (perfil Bitso-chico, Bitso ya usa Proven) | Diferenciación de confianza frente a competidores sin PoR, sin exponer libro de órdenes/AUM real |
| **Emisor de stablecoin** | Emisor regulado bajo MiCA/GENIUS Act u homólogo | **Obligación regulatoria** de atestación periódica — Asfalia la automatiza en vez de pagar atestación manual cada mes |
| **White-label para auditoras** | Firmas tipo The Network Firm / Hacken que quieren ofrecer PoR continuo sin construir el motor ZK | Licencia de plataforma; ellas mantienen la relación con el cliente final y la firma de atestación |

### 3.2 Cuánto — rango justificado

| Tier | Setup fee (una vez) | Suscripción | Ancla usada |
|---|---|---|---|
| DAO / entrada | $500 – $2,000 | **$300 – $1,000/mes** | Por debajo de LedgerLens enterprise, encima de su starter self-serve ($199/mes) |
| Exchange mediano LATAM | $3,000 – $8,000 | **$2,500 – $6,000/mes** ($30k–$72k/año) | En línea con Vanta/Drata mid-market ($20k–$45k/año), premium justificado porque prueba solvencia (activo+pasivo), no solo controles de seguridad |
| Emisor de stablecoin | $8,000 – $15,000 | **$6,000 – $15,000/mes** ($72k–$180k/año) | Muy por debajo del piso de una atestación tradicional completa ($50k–$500k/año) manteniendo *más* frecuencia (continua vs mensual/trimestral) — el argumento de venta es "10x más frecuente por una fracción del costo" |
| White-label auditoras | Custom | **$50,000 – $150,000/año** base + volumen | Licencia de plataforma tipo infra (Space and Time/Chainlink no publican precio, pero son contratos enterprise de este orden en el mercado B2B crypto-infra) |

**Por-attestation vs. suscripción:** el vencimiento del certificado crea recurrencia natural —
no hay "PoR de una sola vez" real cuando el certificado expira solo. Por eso el modelo por
defecto es **suscripción**, no per-attestation. Se ofrece un modo *pay-per-cycle* solo como
puerta de entrada para el tier DAO (equivalente al "starter" de LedgerLens), migrando a
suscripción en cuanto el heartbeat corre en producción.

### 3.3 Qué es open-source y qué se monetiza

**Abierto (Apache 2.0):**
- Motor de circuitos ZK (prueba de solvencia sin revelar montos)
- Librería de pruebas de inclusión Merkle
- Contratos on-chain de verificación y expiración del certificado
- SDK de integración / spec del protocolo

**Se cobra la operación, no el algoritmo:**
- **Daemon heartbeat gestionado 24/7** — que el certificado nunca venza por accidente es el
  producto real; un fallo de operación es un evento reputacional (o regulatorio, bajo MiCA)
- **Portal de verificación hosteado** para que los clientes-del-cliente chequeen su inclusión
  sin correr infraestructura propia
- **SLA y monitoreo** (uptime del heartbeat, alertas antes de vencimiento)
- **Integraciones** con custodia (Fireblocks, Copper, Anchorage) y sistemas contables/ERP
  (SAP, QuickBooks, Cryptio/Bitwave del lado DAO) para automatizar el cálculo de pasivos
- **Reportes compliance-ready** (formato exigido por reguladores tipo MiCA/EBA)
- **Licencia white-label** para que auditoras (The Network Firm, Hacken) ofrezcan PoR continuo
  con su propia marca sin construir el motor ZK desde cero

Este es exactamente el mismo split que Vanta/Drata/Secureframe usan con la auditoría (sección
2.2): la plataforma automatiza, un tercero (o en este caso, la operación gestionada) sostiene
la garantía en el tiempo.

### 3.4 Riesgos del modelo y respuestas

| Riesgo | Respuesta |
|---|---|
| **"Si el motor es Apache 2.0, cualquiera lo clona gratis y corre su propio daemon"** | Correcto, y está bien — el motor es un commodity a propósito (transparencia = credibilidad, igual que el open-core de GitLab/Elastic). Lo que no se clona gratis es la **garantía operativa**: mantener un heartbeat sin fallar 24/7/365 tiene costo real (infra, monitoreo, on-call), y un solo fallo expira el certificado — evento visible on-chain y potencialmente reportable a un regulador. Empresas con AUM real no van a apostar su credibilidad de solvencia a un cronjob que armaron internamente sin SLA. |
| **"¿Por qué pagar si total lo puedo auto-hostear?"** | Mismo argumento que ya validó el mercado con Vanta/Drata/Secureframe: sus checks de compliance tampoco son secretos, y el mercado igual paga $10k–$45k/año por no tener que mantenerlos. El valor no es el código, es no tener que ser el equipo de guardia del propio certificado de solvencia. |
| **Un competidor grande (Chainlink, Hacken, Space and Time) agrega "vencimiento" a su producto** | Ellos no tienen incentivo estructural: Chainlink vende feeds de datos (no atestaciones con pasivos), Hacken vende horas de auditoría humana (el vencimiento automático les canibaliza el negocio recurrente de re-contratación), Space and Time vende infra de queries verificables, no el paquete final. Ninguno está construido nativamente en una L1 de privacidad — Aleo/Aztec/Mina no tienen jugador de PoR (sección 1.2), y Midnight tampoco lo tiene todavía. La ventana de "primero en Midnight con el mecanismo de vencimiento" es real pero no eterna. |
| **Cliente institucional grande prefiere el auditor tradicional (Deloitte/BDO) por peso de marca/regulatorio** | No competir de frente: posicionar a Asfalia como la capa *continua* entre atestaciones formales, y ofrecer el white-label (tier 3.1) para que las mismas auditoras tradicionales lo usen como su motor de continuidad — ingreso indirecto en vez de disputar la relación regulatoria. |
| **Emisor de stablecoin chico no puede pagar $72k–$180k/año** | El setup fee bajo + tier DAO de entrada ($300–$1,000/mes) captura al segmento chico y migra hacia arriba cuando el AUM crece — mismo funnel freemium-a-enterprise que usan Vanta/LedgerLens. |

---

## 4. Matriz competitiva y diferencial

*Ampliación agregada tras el primer draft — el fundador teme que, con tantos actores probando
solvencia hoy (OKX zk-STARK, Binance zk-SNARK, Backpack recursivo diario, Chainlink PoR, The
Network Firm/LedgerLens, Hacken, Proven), alguien ya esté haciendo exactamente lo mismo que
Asfalia. Esta sección responde eso feature por feature, con fuentes, sin inflar.*

### 4.1 Matriz feature por feature

| Actor | 1. Privacidad de composición | 2. Completitud de pasivos (Merkle inclusion/cliente) | 3. Cadencia | 4. Vencimiento forzado on-chain (rechazo automático) | 5. Huecos-como-señal | 6. Open-source / self-hosteable | 7. Quién verifica y cómo |
|---|---|---|---|---|---|---|---|
| **Asfalia** | Sí — ZK, no revela ni balances individuales ni el agregado (activos/pasivos) | Sí — Merkle inclusion por cliente | Continua (heartbeat 24/7, renovación automática) | **Sí — el certificado vencido es criptográficamente inválido en la verificación misma, no depende de que un tercero lo chequee** | Sí por diseño — el estado "expirado" es visible on-chain, el silencio es el evento | Sí — Apache 2.0, motor completo | Cualquiera, gratis, on-chain contra el certificado + Merkle proof propio |
| **Proven / Bitso** | Sí — usa compromisos tipo Pedersen para ocultar el total de activos, no solo balances individuales | Parcial/no confirmado públicamente si hay Merkle path individual descargable por usuario además del zk-SNARK agregado | Mensual (con plan declarado de pasar a diaria) | **No** — el reporte es una foto fechada; "solo es válido para el punto en el tiempo en que se hizo la auditoría", pero la prueba sigue siendo matemáticamente verdadera para siempre, nada la vuelve inválida ni la rechaza | No — depende de que el usuario note que no se publicó el reporte del mes | No — SDK/software propietario de Proven ("ZeKnow Solv") | Cualquier usuario Bitso descarga el recibo y verifica el zk-SNARK; no hay contrato público de verificación abierto a cualquier tercero fuera del ecosistema Bitso |
| **OKX (zk-STARK)** | Parcial — el zk-STARK prueba suma total correcta + no-negativos + inclusión sin exponer balances individuales, **pero el total de reservas se publica igual** (ej. "$11.3B") | Sí — Merkle path descargable, validador zk-STARK público | Mensual (15+ reportes consecutivos) | No — reporte periódico, el anterior no se "rechaza", solo queda viejo | Parcial — la racha mensual es narrativa de confianza, pero no hay mecanismo automático que marque un hueco como evento | Parcial — repo `okx/proof-of-reserves` en GitHub es la herramienta de verificación del usuario, no el motor completo para que un tercero pruebe su propia solvencia | Cualquier usuario OKX, gratis, vía validador zk-STARK descargable |
| **Binance (zk-SNARK)** | Igual patrón que OKX: oculta balances individuales, publica el total agregado | Sí — Merkle sum tree + zk-SNARK, inclusión verificable | Menos consistente que OKX/Bybit (cadencia irregular históricamente, con señales de pasar a mensual) | No — mismo patrón de reporte periódico | No | Parcial — `binance/zkmerkle-proof-of-solvency` está en GitHub, pero es herramienta interna que Binance construyó para sí misma, no un producto adoptable turnkey por un tercero | Cualquier usuario Binance, gratis, vía herramienta propia de Binance |
| **Backpack (Plonky2 recursivo)** | Sí — proofs recursivos sin exponer detalle de cuenta, incluye spot+margin+PnL no realizado | No confirmado públicamente que exista Merkle path individual descargable por usuario | **Diaria, con reconciliación interna cada 10 minutos — la cadencia más agresiva encontrada entre exchanges reales** | No — publicación periódica de alta frecuencia monitoreada por OtterSec, sin mecanismo de rechazo del proof anterior | Parcial — la cadencia diaria hace un hueco muy notorio en la práctica, pero no hay mecanismo formal de registro on-chain del silencio | No — sistema propietario construido con el partner de seguridad OtterSec | Público via reportes publicados; la verificación primaria pasa por OtterSec como partner, no un contrato abierto a cualquiera |
| **Chainlink Proof of Reserve** | **No** — el feed publica el número de reservas directamente on-chain; es infraestructura de datos, no una prueba que oculte nada | No — no hay Merkle inclusion por cliente; es un feed agregado, no un mecanismo de pasivos por usuario | "Heartbeat" = intervalo máximo entre updates (ej. cada 24h) **o** disparo por desviación — es un trigger de actualización de oráculo | **No — ver 4.2, es la distinción que más importa tratar con cuidado** | No — si el DON deja de actualizar, el último valor simplemente queda disponible indefinidamente salvo que algo externo lo note | No — infraestructura propietaria de la red Chainlink (DON), no software que una entidad autohostee para probar su propia solvencia | Cualquier contrato lee el feed gratis; la validación de frescura es responsabilidad de cada contrato consumidor |
| **The Network Firm (Real-Time Reserves)** | No — atestación CPA tradicional, publica cifras | Depende del producto — "Merkle Tree PoR" (línea aparte) sí ofrece esto; "Real-Time Reserves" es atestación firmada, no necesariamente con Merkle path individual | Muy alta — actualizada cada 30 segundos, la cadencia más alta encontrada en general | No — es un reporte de atestación firmado por CPA, no un certificado con lógica de expiración on-chain | No — depende de la relación contractual, sin señal on-chain de hueco | No — servicio profesional de firma contable | Público puede consultar el reporte publicado; no hay verificación criptográfica pública tipo Merkle proof individual en el producto "Real-Time" |
| **LedgerLens** | No — tooling para que auditores generen/publiquen PoR; expone lo que el auditor decida reportar | Sí, como módulo de su suite (Merkle Tree PoR) | Configurable, incluye módulo "Real-Time PoR" | No — es plataforma SaaS de tooling, sin protocolo de expiración forzada | No confirmado | No — SaaS propietario ($199/mes+) | Depende del cliente (el auditor) que use la herramienta; no es gratis/público por defecto |
| **Hacken** | No — combina Merkle Trees + auditoría tradicional; publica el agregado en reportes | Sí — Merkle tree, verificación de inclusión individual | Mensual (Bybit, OKX) | No — reportes de auditoría periódicos | No | No — servicio de auditoría bajo cotización | Usuario final del exchange auditado verifica gratis contra el Merkle root publicado |
| **Aleo / Aztec / Mina** | N/A — no se encontró ningún producto de proof-of-solvency dedicado construido sobre estas L1 | N/A | N/A | N/A | N/A | N/A | N/A — espacio en blanco competitivo |

### 4.2 Chainlink "heartbeat": mismo nombre, mecanismo distinto — tratado con honestidad

El fundador pidió ojo especial acá porque es lo más parecido a `settle()` de Asfalia y el punto
donde un juez técnico va a presionar primero.

**Qué es el heartbeat de Chainlink, literalmente:** un timer que fuerza una actualización del
feed cuando pasa X tiempo sin que el valor se haya movido más allá del *deviation threshold*.
Es decir: "empujá un dato fresco al menos cada N segundos, o antes si cambia mucho". Sirve para
mantener el feed relevante y ahorrar gas cuando el valor es estable. Fuente:
[Chainlink Fundamentals — Proof of Reserve](https://updraft.cyfrin.io/courses/chainlink-fundamentals/chainlink-proof-of-reserve/introduction-to-proof-of-reserve).

**Qué NO es:** no hay ningún mecanismo a nivel de protocolo/consenso que *rechace* una lectura
vieja. `latestRoundData()` sigue devolviendo el último valor indefinidamente, esté fresco o no.
La responsabilidad de decidir "esto está viejo, no lo uso" es 100% del contrato consumidor, vía
un `require()` opcional que compara `updatedAt` contra un umbral que el propio equipo consumidor
define (ej. `require(block.timestamp - updatedAt < 3600, "stale")`). Fuentes:
[Chainlink Data Feeds docs](https://docs.chain.link/data-feeds),
[0xMacro — how to consume Chainlink price feeds safely](https://0xmacro.com/blog/how-to-consume-chainlink-price-feeds-safely/).

**Evidencia de que ese check se olvida en la práctica:** hay una familia recurrente de findings
de seguridad en Code4rena (LoopFi 2024, Predy 2024, Stader 2023, entre otros) exactamente sobre
protocolos que leen un feed Chainlink sin validar `updatedAt`, quedando expuestos a operar sobre
datos obsoletos porque nada se lo impide automáticamente. Fuentes:
[code-423n4/2024-07-loopfi-findings #521](https://github.com/code-423n4/2024-07-loopfi-findings/issues/521),
[code-423n4/2024-05-predy-findings #243](https://github.com/code-423n4/2024-05-predy-findings/issues/243).

Aplicado a Proof of Reserve específicamente: algunos consumidores (TUSD "ripcord", Secure Mint)
sí implementan ese check y pausan el mint si el feed está viejo o por debajo de reservas — pero
es una integración manual, caso por caso, que cada protocolo decide construir o no. Fuente:
[Chainlink — Secure Mint](https://blog.chain.link/secure-mint/).

**La distinción con Asfalia, sin exagerar:** en Asfalia la expiración vive *adentro* de la
lógica de verificación del certificado mismo — un certificado vencido no es "un dato viejo que
alguien podría decidir ignorar", es una prueba que la verificación rechaza por diseño, sin que
el verificador (sea un contrato, sea un humano) tenga que acordarse de chequear un timestamp por
su cuenta. Chainlink resuelve "avisar que hay un dato más nuevo disponible"; Asfalia resuelve
"hacer que el dato viejo deje de ser válido". Son primos, no la misma pieza.

### 4.3 Veredicto final

**(a) Qué es genuinamente único vs. solo mejor:**

- **Genuinamente único (no encontrado en ningún competidor investigado):**
  1. Vencimiento forzado *dentro* de la verificación del certificado, con rechazo automático —
     ni Proven/Bitso (foto fechada pero eternamente "verdadera"), ni Chainlink (staleness check
     opcional del consumidor), ni OKX/Binance/Backpack/Hacken (reportes periódicos que
     simplemente envejecen) tienen esto.
  2. Huecos-como-señal explícita por diseño — en todos los competidores, notar un hueco es
     trabajo manual del usuario/comunidad; en Asfalia el estado "expirado" es un hecho on-chain.
  3. Ser nativo de una L1 de privacidad (Midnight) sin competencia directa — confirmado el
     espacio en blanco en Aleo/Aztec/Mina.

- **Solo mejor (la idea ya existe, Asfalia la ejecuta distinto o más prolijo, pero no la inventa):**
  - Ocultar el agregado (activos/pasivos totales), no solo balances individuales: **Proven ya lo
    hace** vía compromisos Pedersen para Bitso. No es exclusivo de Asfalia.
  - Privacidad de balances individuales vía ZK: ya la tienen OKX (zk-STARK) y Binance (zk-SNARK).
  - Merkle inclusion por cliente: ya la tienen OKX, Binance, Hacken.
  - Cadencia alta/continua: **Backpack ya publica diario con reconciliación cada 10 min, y The
    Network Firm ya ofrece atestación cada 30 segundos** — en frecuencia bruta, ninguno de los
    dos lo tiene fácil Asfalia para superar de entrada.
  - Motor abierto en algún grado: Binance publicó `zkmerkle-proof-of-solvency` en GitHub (aunque
    como herramienta propia, no pensada para que un tercero la adopte como servicio).

**(b) Competidor más cercano, y en qué nos pisa:**

En arquitectura conceptual (ZK + ocultar el agregado + pensado como producto que un tercero
adopta, no una solución interna que un solo exchange construyó para sí mismo), el más cercano es
**Proven** — es lo más parecido a "esto ya existe": ZK, oculta activos y pasivos totales, cliente
real (Bitso) desde 2023, con reportes recurrentes y roadmap declarado hacia diario. Nos pisa
fuerte en: privacidad del agregado (ya resuelto por ellos) y en tener tracción de cliente real
en LATAM — el mercado que Asfalia apuntaría primero. No nos pisa en: vencimiento forzado con
rechazo on-chain (su prueba es una foto fechada, no un certificado que caduca) ni en
huecos-como-señal.

En cadencia bruta, **Backpack** es quien más presiona: diario con reconciliación cada 10
minutos ya es más frecuente que lo que un daemon de heartbeat recién lanzado puede prometer de
entrada sin curva de confianza. Ahí Asfalia no compite en velocidad, compite en que la cadencia
está *enforced* por el protocolo (vence si no se renueva) en vez de ser una promesa operativa de
la empresa.

**(c) El diferencial de una línea que sobrevive a un juez técnico que conoce Chainlink:**

> El heartbeat de Chainlink avisa que hay un dato más nuevo disponible y deja que cada contrato
> decida si le importa que el viejo esté vencido; en Asfalia el vencimiento vive adentro de la
> verificación del certificado mismo — una prueba vieja no es "hay una más nueva en algún lado",
> es una prueba que la verificación **rechaza**, sin que nadie tenga que acordarse de chequear
> un timestamp.

---

## 5. La slide de BizDev

**4 bullets exactos para el pitch deck:**

1. **Quién paga:** la entidad que prueba solvencia (exchange, emisor de stablecoin, tesorería
   DAO) — la verificación del lado del cliente final es **siempre gratis**, sin fricción de red.
2. **Cuánto:** $300–$15,000/mes según tier (DAO → exchange LATAM → emisor de stablecoin) + setup
   fee $500–$15,000. Anclado contra SaaS de compliance comparable (Vanta/Drata: $10k–$45k/año)
   y contra atestaciones tradicionales de PoR ($50k–$500k/año) — Asfalia ofrece **más
   frecuencia por una fracción del costo** de una atestación manual.
3. **Qué se monetiza:** el motor ZK y los contratos on-chain son **Apache 2.0, abiertos**; se
   cobra el **daemon heartbeat gestionado 24/7**, el portal de verificación hosteado, las
   integraciones con custodia/ERP y el SLA — mismo split que ya validó el mercado de
   compliance-as-a-subscription.
4. **Por qué no lo copian gratis:** el código es un commodity a propósito; lo que nadie clona
   gratis es la garantía de que el heartbeat nunca falla — porque si falla, el certificado
   vence on-chain, visible para todos, en una industria donde eso es un evento reputacional
   (y bajo MiCA, potencialmente regulatorio).

---

## Fuentes consultadas (resumen)

- [Proven — CoinDesk](https://www.coindesk.com/business/2023/03/09/zero-knowledge-crypto-startup-proven-raises-158m-in-seed-round) / [BusinessWire](https://www.businesswire.com/news/home/20230309005190/en/Proven-a-Zero-Knowledge-Proof-of-Solvency-Solution-for-Crypto-Raises-15.8M-Seed-Round-Led-by-Framework-Ventures) / [Bitso Blog](https://blog.bitso.com/zero-knowledge-proof-to-show-solvency/)
- [Hacken PoR Audit](https://hacken.io/services/proof-of-reserves-audit/) / [Bybit case study](https://hacken.io/case-studies/bybit-proof-of-reserves/)
- [The Network Firm — Real-Time Reserves](https://www.thenetworkfirm.com/real-time-reserves-for-crypto-blockchain-auditing-the-network-firm)
- [LedgerLens Pricing](https://ledgerlens.io/pricing) / [2025 Review](https://ledgerlens.io/2025-review-changing-crypto-auditing)
- [Space and Time — Trustless PoR](https://www.spaceandtime.io/trustless-proof-of-reserves)
- [Chainlink — Proof of Reserve](https://chain.link/proof-of-reserve)
- [Binance zkmerkle-proof-of-solvency (GitHub)](https://github.com/binance/zkmerkle-proof-of-solvency)
- [Sprinto — Vanta pricing](https://sprinto.com/blog/vanta-pricing/) / [Spendflo — Vanta](https://www.spendflo.com/blog/comprehensive-guide-to-vanta-pricing)
- [Vendr — Drata](https://www.vendr.com/marketplace/drata) / [Costbench — Drata](https://costbench.com/software/compliance-management/drata/)
- [Vendr — Secureframe](https://www.vendr.com/marketplace/secureframe)
- [SOC2Auditors.org — SOC 2 cost](https://soc2auditors.org/soc-2-audit-cost/) / [Drata — SOC 2 cost](https://drata.com/learn/soc-2/cost)
- [Onchain Finance Institute — PoR for stablecoin issuers](https://www.onchainfinanceinstitute.com/articles/proof-of-reserves-for-stablecoin-issuers)
- [Blockworks — Circle/Deloitte](https://blockworks.com/news/circle-taps-deloitte-as-new-auditor-doubles-down-on-proof-of-reserves) / [The Block — Mazars/Tether](https://www.theblock.co/post/193935/skepticism-mazars-crypto-exchange)
- [Scorechain — MiCA stablecoin regulation](https://www.scorechain.com/blog/eu-stablecoin-regulation-mica) / [Eco — MiCA 2026 update](https://eco.com/support/en/articles/14814632-mica-stablecoin-regulation-2026-update)

**Fuentes de la matriz competitiva (sección 4):**

- [OKX — zk-STARK explicación](https://www.okx.com/en-us/help/zero-knowledge-proofs-what-are-zk-starks-and-how-do-they-work) / [OKX PoR 15th report](https://www.okx.com/learn/okx-proof-of-reserves-15) / [okx/proof-of-reserves (GitHub)](https://github.com/okx/proof-of-reserves)
- [Binance — cómo zk-SNARK mejora su PoR](https://www.binance.com/en/blog/tech/how-zksnarks-improve-binances-proof-of-reserves-system-6654580406550811626) / [binance/zkmerkle-proof-of-solvency (GitHub)](https://github.com/binance/zkmerkle-proof-of-solvency)
- [Backpack Exchange — Proof of Reserves](https://learn.backpack.exchange/articles/proof-of-reserves-at-backpack) / [cobertura Arabian Post](https://thearabianpost.com/backpack-exchange-introduces-daily-proof-of-reserves-verification/)
- [Chainlink Fundamentals — Proof of Reserve / heartbeat](https://updraft.cyfrin.io/courses/chainlink-fundamentals/chainlink-proof-of-reserve/introduction-to-proof-of-reserve) / [Chainlink Data Feeds docs](https://docs.chain.link/data-feeds) / [Chainlink — Secure Mint](https://blog.chain.link/secure-mint/) / [0xMacro — consuming Chainlink feeds safely](https://0xmacro.com/blog/how-to-consume-chainlink-price-feeds-safely/)
- Evidencia de staleness no validada: [code-423n4/2024-07-loopfi-findings #521](https://github.com/code-423n4/2024-07-loopfi-findings/issues/521) / [code-423n4/2024-05-predy-findings #243](https://github.com/code-423n4/2024-05-predy-findings/issues/243) / [code-423n4/2024-07-loopfi-findings #494](https://github.com/code-423n4/2024-07-loopfi-findings/issues/494)
- [Bitso Help Center — Proof of Solvency](https://support.bitso.com/hc/en-us/articles/11193181182100-What-is-Proof-of-Solvency) / [Bitso — aplicando ZK a la solvencia](https://support.bitso.com/hc/en-us/articles/14127889799444-Applying-the-Zero-Knowledge-technology-to-prove-solvency) / [Bitso — interpretar el reporte de solvencia](https://support.bitso.com/hc/en-us/articles/14128935576468-What-is-Bitso-s-solvency-report-How-should-I-interpret-it)
- [Hacken — Binance discovery case study](https://hacken.io/case-studies/binance-discovery/) / [Hacken — PoR explicado](https://hacken.io/discover/proof-of-reserves-explained-from-key-mechanics-to-verification/)
