import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import PageHeading from '@/components/PageHeading';
import {
  ICONOS_PRENDA,
  Seccion,
  IconoBombilla,
  IconoCamiseta,
  IconoLista,
  IconoOjo,
  IconoRegla,
  IconoTabla,
} from '@/components/SeccionInfo';
import { RECOMENDACIONES, TABLAS_TALLAS, type TablaTallas } from '@/lib/guia-tallas';

export const metadata: Metadata = {
  title: 'Guía de tallas',
  description:
    'Cómo elegir tu talla sin fallar: mide tu ropa, comprueba las tablas y consulta las recomendaciones por prenda de KOVA ZONE.',
};

export default function GuiaTallasPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: 'Guía de tallas' }]} />
      <PageHeading
        eyebrow="Antes de comprar"
        title="Guía de tallas"
        description="Cómo elegir tu talla sin fallar"
      />

      <div className="space-y-10">
        <Seccion titulo="Conoce tus medidas" icono={<IconoRegla className="h-5 w-5" />}>
          <p>
            Antes de nada, ten claras tus tallas en todo tipo de prendas: camisetas, pantalones,
            calzoncillos… Lo más fiable es{' '}
            <strong className="font-semibold">medir ropa que ya tengas</strong>.
          </p>
          <ul className="mt-4 space-y-3">
            <li>Extiéndela y pásale una cinta de medir al ancho, largo, cintura y hombros.</li>
            <li>Apunta las medidas: así tendrás tus medidas estándar siempre a mano.</li>
          </ul>
        </Seccion>

        <Seccion
          titulo="Cómo saber si una prenda te quedará bien"
          icono={<IconoOjo className="h-5 w-5" />}
        >
          <ul className="space-y-3">
            <li>
              <strong className="font-semibold">Tabla de tallas del producto.</strong> Muchas fichas
              incluyen, más abajo, una tabla con las medidas de la prenda. Compara ahí tus medidas.
            </li>
            <li>
              <strong className="font-semibold">Fotos reales de otros compradores.</strong> Verás la
              prenda medida con una cinta. Fíjate en qué talla es y compara sus medidas con las
              tuyas: si es más grande que las tuyas, baja una talla; si es más pequeña, sube una.
            </li>
            <li>
              <strong className="font-semibold">Ante la duda, una talla más.</strong> Mejor que venga
              un poco grande a que venga pequeña.
            </li>
          </ul>
        </Seccion>

        <Seccion titulo="Recomendaciones por prenda" icono={<IconoCamiseta className="h-5 w-5" />}>
          <div className="grid gap-4 sm:grid-cols-2">
            {RECOMENDACIONES.map((r) => {
              const Icono = ICONOS_PRENDA[r.icono];
              return (
                <div key={r.prenda} className="rounded-card border border-line bg-mist/40 p-4">
                  <p className="flex items-center gap-2 font-semibold text-ink">
                    <Icono className="h-5 w-5 text-brand" />
                    {r.prenda}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-6 text-ink/80">
                    {r.detalle.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Seccion>

        <Seccion
          titulo="Tablas de medidas de equipaciones"
          icono={<IconoTabla className="h-5 w-5" />}
        >
          <div className="space-y-8">
            {TABLAS_TALLAS.map((t) => (
              <TablaMedidas key={t.titulo} tabla={t} />
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Tabla resumen" icono={<IconoLista className="h-5 w-5" />}>
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-5 py-2 font-semibold sm:px-6">
                    Prenda
                  </th>
                  <th scope="col" className="px-5 py-2 font-semibold sm:px-6">
                    Recomendación
                  </th>
                </tr>
              </thead>
              <tbody>
                {RECOMENDACIONES.map((r) => (
                  <tr key={r.prenda} className="border-b border-line/60">
                    <td className="px-5 py-2 font-medium text-ink sm:px-6">{r.prenda}</td>
                    <td className="px-5 py-2 text-ink/80 sm:px-6">{r.resumen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>

        <Seccion titulo="Consejo final" icono={<IconoBombilla className="h-5 w-5" />}>
          <p>
            Si te quedas con la duda, busca la{' '}
            <strong className="font-semibold">guía oficial de la marca</strong> en su web y fíjate en
            el tipo de corte (ajustado, holgado…). Con estos pasos no deberías volver a fallar con la
            talla.
          </p>
          <p className="mt-4">
            ¿Sigues con dudas?{' '}
            <Link
              href="/envios-devoluciones"
              className="font-medium text-brand underline underline-offset-2"
            >
              El cambio de talla es gratis
            </Link>
            .
          </p>
        </Seccion>
      </div>
    </>
  );
}

function TablaMedidas({ tabla }: { tabla: TablaTallas }) {
  return (
    <div>
      <h3 className="mb-1 font-display text-base font-bold tracking-tight">{tabla.titulo}</h3>
      {tabla.nota && <p className="mb-2 text-xs text-muted">{tabla.nota}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {tabla.columnas.map((c, i) => (
                <th key={c} scope="col" className="px-3 py-2 font-semibold">
                  {c}
                  {tabla.unidades[i] && <span className="text-muted"> ({tabla.unidades[i]})</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabla.filas.map((fila) => (
              <tr key={fila[0]} className="border-b border-line/60">
                {fila.map((celda, i) => (
                  <td
                    key={i}
                    className={
                      i === 0
                        ? 'px-3 py-2 font-medium text-ink'
                        : 'px-3 py-2 text-ink/80 tabular-nums'
                    }
                  >
                    {celda}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
