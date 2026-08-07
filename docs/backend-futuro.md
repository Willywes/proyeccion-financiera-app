# Llevar la app a un sistema compartido con API

Notas de la evaluación hecha en agosto de 2026, para cuando se retome. Hoy la app
es local: SQLite en el teléfono y PIN de acceso, sin servidor. El objetivo
evaluado fue convertirla en un sistema multiusuario con API propia, consumible
desde la app y desde una futura web, con login de Google, para uso interno y con
costo bajo.

## Recomendación: Cloudflare Workers + D1 + Hono

La razón principal no es el precio, es la continuidad con lo que ya está escrito.

**D1 es SQLite.** `src/db/migrations.ts` y las consultas de `src/repositories/`
migran prácticamente sin cambios. Con Postgres habría que rehacer schema y
queries.

**El dominio corre igual en el servidor.** `src/domain/projection.ts` y
`src/domain/amortization.ts` son TypeScript puro, sin dependencias de React
Native. Se mueven a un paquete compartido y el cálculo de proyecciones y cuotas
queda con una sola implementación para app, web y API. Evita el problema de que
el cliente muestre un saldo y el servidor calcule otro.

**Hono** como framework HTTP: TS-first, corre en Workers, y permite exportar los
tipos del router al cliente para tener llamadas tipadas de punta a punta.

## Costos comparados

| Opción | Gratis | Al crecer | Nota |
|---|---|---|---|
| **Cloudflare Workers + D1** | 100k req/día · D1 5 GB, 5M lecturas/día, 100k escrituras/día | $5/mes | Una app interna no se acerca a esos límites |
| Supabase | 500 MB DB · 50k MAU | $25/mes | Los proyectos gratis se pausan tras una semana sin uso |
| DigitalOcean droplet | — | $4–6/mes más tiempo de operación | TLS, backups, updates y monitoreo quedan a cargo de uno |

El pausado de Supabase pesa: una app interna de uso esporádico se duerme seguido,
lo que en la práctica empuja al plan de $25/mes. Cloudflare no se comporta así.

Fuentes consultadas: [precios de Workers](https://developers.cloudflare.com/workers/platform/pricing/),
[stack Workers + Hono + D1](https://www.buildmvpfast.com/blog/cloudflare-workers-hono-d1-r2-free-fullstack-2026),
[precios de Supabase](https://uibakery.io/blog/supabase-pricing).

## Login con Google

Cloudflare Access (Zero Trust) ofrece login con Google gratis hasta 50 usuarios,
pero está pensado para navegador: en una app móvil nativa el flujo es incómodo.
No conviene como autenticación de la app.

Lo que funciona igual en app y web, y es portable entre proveedores:

1. Google Sign-In nativo en la app con `expo-auth-session`.
2. La app recibe el ID token de Google.
3. El Worker lo verifica contra las claves públicas de Google.
4. El Worker emite su propio JWT de sesión.

Son unas cien líneas y no atan a ningún proveedor. La alternativa es Supabase
Auth, que entrega eso ya configurado: es su mejor argumento frente a Cloudflare y
es razonable pagar los $25/mes por saltarse ese trabajo.

DigitalOcean sólo se justifica si aparece algo que Workers no cubre: procesos
largos, cron pesado, binarios nativos o Postgres con extensiones.

## Dos decisiones a tomar antes de escribir código

El stack es la parte fácil. Esto es lo que define el trabajo real.

### 1. ¿Offline-first o cliente delgado?

En una app de gastos pesa mucho: la gente anota el gasto en la fila del
supermercado, sin señal. Si se mantiene SQLite local como fuente de escritura y
se sincroniza, el schema actual necesita cambios que hoy son baratos y después no:

- **IDs globales** (UUID o ULID) en lugar de `INTEGER PRIMARY KEY AUTOINCREMENT`.
  Dos teléfonos trabajando sin conexión generarían ambos el `id = 5`.
- **`updated_at` y borrado lógico** (tombstones). Un `DELETE` no se propaga solo:
  el otro dispositivo nunca se entera de que la fila existió.
- **Cursor de sincronización por dispositivo**, para pedir sólo lo que cambió.

Si la app pasa a ser siempre-online nada de esto hace falta, pero se pierde el
registro sin señal.

### 2. ¿"Compartido" es cada uno lo suyo, o varios sobre las mismas finanzas?

Si varias personas comparten un mismo presupuesto (pareja, familia, equipo), las
tablas no cuelgan de `user_id` sino de un `workspace_id`, y el usuario es miembro
con un rol. Incorporar ese concepto ahora es agregar una columna; después es una
migración de datos incómoda.

### Nota sobre el modelo actual de usuario

La tabla `users` de hoy es un perfil local con PIN. En el modelo compartido pasa a
ser identidad remota. El PIN puede conservarse como bloqueo de app —es buena UX—
pero deja de ser el mecanismo de autenticación.

## Ruta de migración

El punto de corte ya existe y no es casualidad: **`src/repositories/` es la única
capa que toca SQL**. Se reemplaza la implementación de esos módulos por llamadas
HTTP, o por un repositorio que lee de SQLite local y encola cambios para
sincronizar. Ni el dominio ni las pantallas se enteran.

Estructura sugerida si se avanza:

```
packages/
├── domain/        src/domain actual, compartido por app, web y Worker
├── api/           Worker con Hono + D1: rutas, auth, migraciones del servidor
└── app/           la app actual, con repositorios apuntando al API
```
