// TEMPORAL: página para encontrar qué enlace abre Huawei Health desde el celular.
// Se borra en cuanto se sepa cuál funciona.

const PACKAGE = 'com.huawei.health';

const LINKS: [string, string][] = [
  ['A', `intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${PACKAGE};end`],
  ['B', `intent://healthapp#Intent;scheme=huaweischeme;package=${PACKAGE};end`],
  ['C', 'huaweischeme://healthapp/home/main'],
  ['D', `intent://#Intent;package=${PACKAGE};end`],
  ['E', `market://details?id=${PACKAGE}`],
  ['F', 'https://appgallery.huawei.com/app/C10414141'],
];

export default function HuaweiTestPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 p-5">
      <h1 className="font-display text-3xl font-extrabold">Prueba de Huawei Health</h1>
      <p className="text-sm text-ink-2">Toca cada botón y anota qué pasa: si abre Huawei Health, otra app, una tienda o nada.</p>
      {LINKS.map(([label, href]) => (
        <a key={label} href={href} className="rounded-2xl border-2 border-outline bg-card px-4 py-4 text-lg font-bold">
          Botón {label}
        </a>
      ))}
    </main>
  );
}
