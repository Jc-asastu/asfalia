// Textos de la interfaz, EN por defecto, ES intercambiable.
// Un solo diccionario plano: la clave es el texto de referencia en ingles corto.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'es';

const STR = {
  en: {
    subtitle: 'Solvency certification without data disclosure · Midnight Network',
    network: 'network',
    contract: 'contract',
    connecting: 'connecting…',
    landing_kicker: 'Private solvency certification on Midnight',
    landing_tagline: 'Proof of Solvency that expires.',
    landing_sub: 'An entity proves its assets cover its liabilities without revealing a single number — and the certificate dies on-chain unless it is renewed. From a monthly snapshot to a heartbeat.',
    landing_live_fresh: 'certificate in force',
    landing_live_expired: 'certificate expired',
    landing_emissions: (n: number) => `${n} certificates emitted`,
    landing_entity_cta: 'Get started',
    landing_entity_lead: 'The console runs on your machine — your books never leave it. Six commands:',
    landing_link_repo: 'GitHub repository',
    landing_link_guide: 'Deployment guide',
    landing_entity_demo: 'Enter demo console',
    landing_auditor_cta: 'Verify now',
    landing_client_cta: 'Check my balance',
    role_title: 'Who are you?',
    role_lead: 'Asfalia separates three roles. Each one sees only what belongs to it — that separation is the product.',
    role_entity: 'Entity',
    role_entity_desc: 'I certify my solvency. This console runs on my machine — my books never leave it. No login: possession is authentication.',
    role_auditor: 'Auditor / counterparty',
    role_auditor_desc: 'I verify. This view reads only the public chain: verdict, validity, roots, history. No login — everything here is already public.',
    role_client: 'Client of the entity',
    role_client_desc: 'I check that my balance is counted. I only see my own account and sibling hashes — never another balance.',
    role_change: 'change role',
    tab_treasury: 'Treasury · entity',
    tab_auditor: 'Certificate · auditor',
    tab_portal: 'Portal · client',

    // Treasury
    private_banner: 'Private books — they live only on the entity’s machine',
    assets: 'Assets',
    liabilities: 'Liabilities — client accounts (16)',
    total: 'Total',
    coverage: 'Liability coverage:',
    position: 'Position:',
    covered: 'covered',
    uncovered: 'uncovered',
    attest_btn: 'Generate attestation',
    attest_btn_busy: 'Generating proof…',
    no_attest_yet: 'No attestations this session.',
    loading_books: 'Loading books…',
    edit_amount: 'Edit amount',
    action_note_1: 'The attestation generates a ',
    action_note_zk: 'zero-knowledge proof',
    action_note_2:
      ' over these books and publishes only the verdict, the timestamps, the assets commitment and the ',
    action_note_root: 'Merkle root',
    action_note_3:
      ' of the accounts. The amounts take part in no transmission — and no client can be left out of the tree without their verification failing.',

    // Job phases (codes from the API)
    phase_idle: '',
    phase_proving: 'Generating ZK proof — the balances do not leave this machine',
    phase_verified: 'Verified on-chain',
    phase_settling: 'Accepting certificate — the chain checks validity',
    phase_settled: 'Certificate accepted on-chain',
    phase_rejected_expired: 'REJECTED: the certificate has expired',
    phase_rejected_insolvent: 'REJECTED: the certificate does not prove solvency',
    phase_failed_attest: 'Attestation failed',
    phase_failed_settle: 'Settlement failed',

    // Certificate
    kicker: 'Certificate of solvency · zero-knowledge proof',
    record_title: 'Attestation record',
    attesting_entity: 'Attesting entity:',
    declaration:
      'The entity certifies that the entirety of its assets covers the entirety of its liabilities, without exhibiting any amount, composition or counterparty.',
    not_attested: 'NOT ATTESTED',
    solvent: 'Solvent',
    not_solvent: 'Not solvent',
    expired_stamp: 'Expired',
    attested_at: 'Attested at',
    validity: (w: string) => `Validity (window ${w} set on-chain)`,
    valid_until: (t: string) => `VALID — expires in ${t}`,
    grace_until: (t: string) => `IN GRACE — expires in ${t}`,
    expired_line: 'EXPIRED — the verdict is no longer acceptable',
    assets_commitment: 'Assets commitment',
    liabilities_root: 'Liabilities Merkle root (accounts)',
    last_tx: 'Last transaction',
    verified_line: 'Verified on-chain — anyone verifies, no one sees',
    accept_cert: 'Accept certificate',
    accept_cert_hint: 'The chain only accepts a solvent and valid certificate',
    reveal: 'Reveal data',
    reveal_title: 'There is no data to reveal.',
    reveal_body:
      ' The balances never left the entity’s machine. What traveled the chain is a cryptographic proof, not a number.',
    settle_checking: 'Verifying on-chain…',
    settle_rejected_suffix: ' — the transaction did not enter the block',
    settle_tx: 'tx',

    // History
    tab_history: 'History · heartbeat',
    hist_banner: 'Emission history — every certificate points to its on-chain transaction; a gap means the entity chose not to prove',
    hist_title: 'Certificate heartbeat',
    hist_beating: (s: number) => `emitting every ${s}s`,
    hist_next: (s: number) => `next in ${s}s`,
    hist_off: 'heartbeat off — manual emissions only',
    hist_gap: 'No attestation',
    hist_gap_legend: 'chose not to prove',
    hist_gap_note:
      'No certificate was emitted in this period. The daemon is automated — a gap is not an accident, it is the entity unplugging its own heartbeat. Silence, recorded.',
    hist_failed: 'Emission failed',
    hist_emitted: 'Emitted',
    hist_trigger: 'Trigger',
    hist_auto: 'heartbeat (automatic)',
    hist_manual: 'manual',
    hist_duration: 'Proof time',
    hist_period: 'Period',
    chain_label: 'Chain says (devnet indexer, first-hand):',
    chain_block: 'block',
    tab_scanner: 'Scanner · chain',
    scan_head: 'Chain head',
    scan_head_hash: 'Head hash',
    scan_head_time: 'Head time',
    scan_contract: 'Contract',
    scan_title: 'Contract transactions',
    scan_lead: 'Every emission resolved against the devnet indexer: real hash, block, timestamp. The data comes from the chain — the log only contributes the verdict. Click a row for full hashes.',
    scan_block: 'Block',
    scan_time: 'Time',
    scan_txhash: 'Tx hash',
    scan_verdict: 'Verdict',
    scan_identifier: 'Identifier (SDK)',
    scan_blockhash: 'Block hash',
    scan_empty: 'No transactions yet — the next heartbeat will land here.',

    // Portal
    portal_banner: 'Client view — sees only their own account and sibling hashes, never another balance',
    portal_title: 'Inclusion verification',
    portal_lead:
      'Is my balance counted within the liabilities the entity declared? The answer does not come from the entity: it comes from the tree, checked against the root published on-chain.',
    account: 'Account',
    choose_account: 'Choose account…',
    portal_busy: 'Rebuilding the path to the root…',
    included: '✓ Your balance is included in the declared liabilities',
    not_verified: '✕ Could not verify',
    not_verified_reason_root: ': the root does not match the chain',
    no_attest_reason: 'no on-chain attestation yet',
    holder: 'Holder',
    own_balance: 'Own balance',
    leaf: 'Leaf (hash of your account)',
    path: 'Verification path',
    siblings: (n: number) => `${n} siblings — hashes only`,
    reconstructed_root: 'Reconstructed root',
    portal_note:
      'The root reconstructed from your leaf was compared against the Merkle root published on-chain by the attestation. If the entity omitted your account — or lied about your balance — this path would not close.',
  },
  es: {
    subtitle: 'Certificación de solvencia sin revelación de datos · Midnight Network',
    network: 'red',
    contract: 'contrato',
    connecting: 'conectando…',
    landing_kicker: 'Certificación privada de solvencia en Midnight',
    landing_tagline: 'Proof of Solvency that expires.',
    landing_sub: 'Una entidad prueba que sus activos cubren sus pasivos sin revelar un solo número — y el certificado muere on-chain si no se renueva. De la foto mensual al latido.',
    landing_live_fresh: 'certificado vigente',
    landing_live_expired: 'certificado vencido',
    landing_emissions: (n: number) => `${n} certificados emitidos`,
    landing_entity_cta: 'Empezar',
    landing_entity_lead: 'La consola corre en tu máquina — tus libros no salen de ahí. Seis comandos:',
    landing_link_repo: 'Repositorio en GitHub',
    landing_link_guide: 'Guía de deployment',
    landing_entity_demo: 'Entrar a la consola demo',
    landing_auditor_cta: 'Verificar ahora',
    landing_client_cta: 'Chequear mi saldo',
    role_title: '¿Quién sos?',
    role_lead: 'Asfalia separa tres roles. Cada uno ve solo lo que le corresponde — esa separación es el producto.',
    role_entity: 'Entidad',
    role_entity_desc: 'Certifico mi solvencia. Esta consola corre en mi máquina — mis libros no salen de acá. Sin login: la posesión es la autenticación.',
    role_auditor: 'Auditor / contraparte',
    role_auditor_desc: 'Verifico. Esta vista lee solo la cadena pública: veredicto, vigencia, raíces, historial. Sin login — todo lo que muestra ya es público.',
    role_client: 'Cliente de la entidad',
    role_client_desc: 'Chequeo que mi saldo esté contado. Veo solo mi propia cuenta y hashes de hermanos — jamás otro saldo.',
    role_change: 'cambiar rol',
    tab_treasury: 'Tesorería · entidad',
    tab_auditor: 'Certificado · auditor',
    tab_portal: 'Portal · cliente',

    private_banner: 'Libros privados — viven únicamente en la máquina de la entidad',
    assets: 'Activos',
    liabilities: 'Pasivos — cuentas de clientes (16)',
    total: 'Total',
    coverage: 'Cobertura de pasivos:',
    position: 'Posición:',
    covered: 'cubierta',
    uncovered: 'descubierta',
    attest_btn: 'Generar attestación',
    attest_btn_busy: 'Generando prueba…',
    no_attest_yet: 'Sin attestaciones en esta sesión.',
    loading_books: 'Cargando libros…',
    edit_amount: 'Editar importe',
    action_note_1: 'La attestación genera una ',
    action_note_zk: 'prueba de conocimiento cero',
    action_note_2:
      ' sobre estos libros y publica únicamente el veredicto, los tiempos, el compromiso de activos y la ',
    action_note_root: 'raíz Merkle',
    action_note_3:
      ' de las cuentas. Los importes no participan de ninguna transmisión — y ningún cliente puede quedar afuera del árbol sin que su verificación falle.',

    phase_idle: '',
    phase_proving: 'Generando prueba ZK — los balances no salen de esta máquina',
    phase_verified: 'Verificado en cadena',
    phase_settling: 'Aceptando certificado — la cadena verifica vigencia',
    phase_settled: 'Certificado aceptado en cadena',
    phase_rejected_expired: 'RECHAZADO: el certificado está vencido',
    phase_rejected_insolvent: 'RECHAZADO: el certificado no acredita solvencia',
    phase_failed_attest: 'Falló la attestación',
    phase_failed_settle: 'Falló el settlement',

    kicker: 'Certificado de solvencia · prueba de conocimiento cero',
    record_title: 'Acta de attestación',
    attesting_entity: 'Entidad que acredita:',
    declaration:
      'La entidad acredita que la totalidad de sus activos cubre la totalidad de sus pasivos, sin exhibir importe, composición ni contraparte alguna.',
    not_attested: 'SIN ATTESTACIÓN',
    solvent: 'Solvente',
    not_solvent: 'No solvente',
    expired_stamp: 'Vencido',
    attested_at: 'Atestado',
    validity: (w: string) => `Vigencia (ventana ${w} fijada en cadena)`,
    valid_until: (t: string) => `VIGENTE — vence en ${t}`,
    grace_until: (t: string) => `EN GRACIA — vence en ${t}`,
    expired_line: 'VENCIDO — el veredicto ya no es aceptable',
    assets_commitment: 'Compromiso sobre activos',
    liabilities_root: 'Raíz Merkle de pasivos (cuentas)',
    last_tx: 'Última transacción',
    verified_line: 'Verificado en cadena — cualquiera verifica, nadie ve',
    accept_cert: 'Aceptar certificado',
    accept_cert_hint: 'La cadena solo acepta un certificado solvente y vigente',
    reveal: 'Revelar datos',
    reveal_title: 'No hay datos que revelar.',
    reveal_body:
      ' Los balances nunca salieron de la máquina de la entidad. Lo que viajó por la cadena es una prueba criptográfica, no un número.',
    settle_checking: 'Verificando en cadena…',
    settle_rejected_suffix: ' — la transacción no entró al bloque',
    settle_tx: 'tx',

    tab_history: 'Historial · latido',
    hist_banner: 'Historial de emisiones — cada certificado apunta a su transacción on-chain; un hueco significa que la entidad eligió no probar',
    hist_title: 'Latido de certificados',
    hist_beating: (s: number) => `emitiendo cada ${s}s`,
    hist_next: (s: number) => `próximo en ${s}s`,
    hist_off: 'latido apagado — solo emisiones manuales',
    hist_gap: 'Sin attestación',
    hist_gap_legend: 'eligió no probar',
    hist_gap_note:
      'En este período no se emitió certificado. El daemon es automático — un hueco no es un accidente: es la entidad desenchufando su propio latido. El silencio, registrado.',
    hist_failed: 'Falló la emisión',
    hist_emitted: 'Emitido',
    hist_trigger: 'Disparo',
    hist_auto: 'latido (automático)',
    hist_manual: 'manual',
    hist_duration: 'Tiempo de prueba',
    hist_period: 'Período',
    chain_label: 'La cadena dice (indexer de la devnet, primera mano):',
    chain_block: 'bloque',
    tab_scanner: 'Scanner · cadena',
    scan_head: 'Cabeza de cadena',
    scan_head_hash: 'Hash de cabeza',
    scan_head_time: 'Hora de cabeza',
    scan_contract: 'Contrato',
    scan_title: 'Transacciones del contrato',
    scan_lead: 'Cada emisión resuelta contra el indexer de la devnet: hash real, bloque, timestamp. Los datos vienen de la cadena — el log solo aporta el veredicto. Click en una fila para los hashes completos.',
    scan_block: 'Bloque',
    scan_time: 'Hora',
    scan_txhash: 'Hash de tx',
    scan_verdict: 'Veredicto',
    scan_identifier: 'Identifier (SDK)',
    scan_blockhash: 'Hash del bloque',
    scan_empty: 'Sin transacciones todavía — el próximo latido aterriza acá.',

    portal_banner: 'Vista del cliente — solo ve su propia cuenta y hashes de hermanos, jamás otro saldo',
    portal_title: 'Verificación de inclusión',
    portal_lead:
      '¿Mi saldo está contado dentro de los pasivos que la entidad declaró? La respuesta no la da la entidad: la da el árbol, contra la raíz publicada en cadena.',
    account: 'Cuenta',
    choose_account: 'Elegir cuenta…',
    portal_busy: 'Reconstruyendo el camino hasta la raíz…',
    included: '✓ Tu saldo está incluido en los pasivos declarados',
    not_verified: '✕ No se pudo verificar',
    not_verified_reason_root: ': la raíz no coincide con la cadena',
    no_attest_reason: 'sin attestación on-chain todavía',
    holder: 'Titular',
    own_balance: 'Saldo propio',
    leaf: 'Hoja (hash de tu cuenta)',
    path: 'Camino de verificación',
    siblings: (n: number) => `${n} hermanos — solo hashes`,
    reconstructed_root: 'Raíz reconstruida',
    portal_note:
      'La raíz reconstruida desde tu hoja se comparó contra la raíz Merkle publicada on-chain por el attest. Si la entidad omitiera tu cuenta —o mintiera tu saldo— este camino no cerraría.',
  },
} as const;

export type Strings = (typeof STR)['en'];

const I18nContext = createContext<{ t: Strings; lang: Lang; setLang: (l: Lang) => void }>({
  t: STR.en,
  lang: 'en',
  setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(
    () => (localStorage.getItem('asfalia-lang') as Lang) || 'en',
  );
  useEffect(() => {
    localStorage.setItem('asfalia-lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <I18nContext.Provider value={{ t: STR[lang] as Strings, lang, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);

/** Traduce un codigo de fase del server. */
export function phaseText(t: Strings, code: string): string {
  const key = `phase_${code}` as keyof Strings;
  const v = t[key];
  return typeof v === 'string' ? v : code;
}

export const dateLocale = (lang: Lang) => (lang === 'es' ? 'es-AR' : 'en-GB');
