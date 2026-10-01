import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import PageHeading from '@/components/PageHeading';
import { Seccion, IconoCamion, IconoCamiseta, IconoCruz, IconoInfo } from '@/components/SeccionInfo';

export const metadata: Metadata = {
  title: 'Envíos y devoluciones',
  description:
    'Plazos de envío, peninsular únicamente, cambio de talla y productos sin devolución en KOVA ZONE.',
};

const TELEGRAM_USER = process.env.NEXT_PUBLIC_TELEGRAM_USERNAME;

/* El plazo de entrega se declara en un solo sitio: aparece en la portada, en el
 * pie y aquí. Si cambia, cambia en los tres. */
const PLAZO = '10 a 15 días';

export default function EnviosDevolucionesPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: 'Envíos y devoluciones' }]} />
      <PageHeading
        eyebrow="Antes de comprar"
        title="Envíos y devoluciones"
        description="Lo que necesitas saber antes de confirmar tu pedido"
      />

      <div className="space-y-10">
        <Seccion titulo="Envíos" icono={<IconoCamion className="h-5 w-5" />}>
          <ul className="space-y-3">
            <li>
              <strong className="font-semibold">Solo península.</strong> Enviamos a todo el
              territorio peninsular español. No enviamos a Canarias, Ceuta, Melilla ni al
              extranjero.
            </li>
            <li>
              <strong className="font-semibold">Plazo habitual: {PLAZO}.</strong> Desde la
              confirmación del pedido hasta la entrega. Es un plazo estimado: si el paquete se
              retrasa, te avisamos por el mismo canal que usamos para el pedido.
            </li>
            <li>
              <strong className="font-semibold">Te avisamos cuando salga.</strong> Recibirás un
              mensaje con el seguimiento en cuanto el paquete esté en ruta.
            </li>
            <li>
              <strong className="font-semibold">Revisa la entrega.</strong> Si el paquete llega con
              desperfectos visibles o sin abrir, no lo aceptes: escríbenos antes de rechazarlo y lo
              resolvemos.
            </li>
          </ul>
        </Seccion>

        <Seccion titulo="Devoluciones y cambio de talla" icono={<IconoCamiseta className="h-5 w-5" />}>
          <p>
            En <strong className="font-semibold">equipaciones, zapatillas y ropa</strong> el
            cambio de talla es la vía de devolución. Si la talla que pediste no es la correcta, te
            enviamos <strong className="font-semibold">el mismo producto en la talla correcta</strong>.
          </p>
          <ul className="mt-4 space-y-3">
            <li>
              <strong className="font-semibold">Plazo: 14 días desde la entrega.</strong> Avísanos
              dentro de ese plazo y tramitamos el cambio.
            </li>
            <li>
              <strong className="font-semibold">El envío lo paga KOVA ZONE.</strong> Tanto la
              devolución como el reenvío de la talla correcta van por nuestra cuenta: el cambio no
              te cuesta nada.
            </li>
            <li>
              <strong className="font-semibold">La prenda debe estar sin usar</strong> y con su
              etiqueta original. Si la única manera de probarla deja marca, el cambio no procede:
              preferimos decírtelo antes a que pierdas el envío.
            </li>
            <li>
              <strong className="font-semibold">Un cambio por artículo.</strong> Si tras el primer
              cambio la talla sigue sin encajar, escríbenos y lo vemos.
            </li>
          </ul>
          <p className="mt-4">
            <strong className="font-semibold">Cómo se pide:</strong>{' '}
            {telegramEnlace(
              'por Telegram',
              'Escríbenos por Telegram indicando tu número de pedido, el producto y la talla correcta. Te damos las instrucciones de devolución.',
            )}
          </p>
        </Seccion>

        <Seccion titulo="Sin devolución" icono={<IconoCruz className="h-5 w-5" />}>
          <p>
            Por su naturaleza, <strong className="font-semibold">los relojes, los perfumes y la
            electrónica no admiten devolución ni cambio</strong>, ni de talla ni por otro motivo.
          </p>
          <ul className="mt-4 space-y-3">
            <li>
              <strong className="font-semibold">Electrónica.</strong> Comprueba el estado del
              producto en el momento de recibirlo. Si llega dañada o no funciona, escríbenos dentro
              de los 14 días y lo revisamos contigo.
            </li>
            <li>
              <strong className="font-semibold">Perfumes.</strong> Por higiene, solo se aceptan si
              el envase está precintado. Una vez abierto, ya no podemos recogerlo.
            </li>
            <li>
              <strong className="font-semibold">Relojes.</strong> No se devuelven. Si llega con un
              defecto de fábrica, escríbenos y lo gestionamos como garantía, no como devolución.
            </li>
          </ul>
          <p className="mt-4">
            Ante la duda, {telegramEnlace('pregúntanos antes de comprar', 'Pregúntanos antes de comprar. Es más barato que comprar y tener que devolver.')}
          </p>
        </Seccion>

        <Seccion titulo="Resumen en una línea" icono={<IconoInfo className="h-5 w-5" />}>
          <ul className="space-y-2">
            <li className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Envíos</span>
              <span>Solo península · {PLAZO} · te avisamos con el seguimiento.</span>
            </li>
            <li className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Cambio de talla</span>
              <span>Equipaciones, zapatillas y ropa · 14 días · envío por nuestra cuenta.</span>
            </li>
            <li className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Sin devolución</span>
              <span>Relojes · perfumes · electrónica.</span>
            </li>
          </ul>
        </Seccion>
      </div>
    </>
  );
}

/** Enlace a Telegram cuando hay usuario configurado; si no, el mismo texto en
 *  plano, para que el texto legal se lea igual en ambos casos. */
function telegramEnlace(texto: string, fallback: string) {
  if (!TELEGRAM_USER) return <>{fallback}</>;
  return (
    <a
      href={`https://t.me/${TELEGRAM_USER}`}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-brand underline underline-offset-2"
    >
      {texto}
    </a>
  );
}