# Actualizar cambios de `shopp-server` en Heroku

Este documento explica cómo trabajar con el servidor de la aplicación **Shopp** (`shopp-server`) usando:

- VS Code
- Git
- GitHub
- Heroku
- Heroku CLI

La idea general es:

```text
VS Code / local
   ↓ git add / commit
GitHub repo: shopp-server
   ↓ deploy automático o manual
Heroku app: shopp-server
```

---

# 1. Revisión previa del servidor Node.js

Antes de desplegar en Heroku, revisa que tu servidor use el puerto asignado por Heroku.

En `index.js` o archivo principal del servidor, debe existir algo parecido a esto:

```js
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
```

No conviene usar únicamente:

```js
server.listen(3000);
```

En local puedes usar el puerto `3000`, pero en Heroku el puerto lo define la propia plataforma mediante:

```js
process.env.PORT
```

---

# 2. Revisar `package.json`

Tu `package.json` debería tener un script `start`.

Ejemplo:

```json
{
  "scripts": {
    "start": "node index.js"
  }
}
```

Si tu archivo principal se llama de otra forma, por ejemplo `server.js`, entonces sería:

```json
{
  "scripts": {
    "start": "node server.js"
  }
}
```

---

# 3. Revisar `Procfile`

En la raíz del proyecto `shopp-server`, puedes tener un archivo llamado:

```text
Procfile
```

Sin extensión.

Contenido recomendado:

```text
web: npm start
```

Este archivo le indica a Heroku cómo debe arrancar tu servidor.

---

# 4. Flujo recomendado: VS Code → GitHub → Heroku

Este es el flujo más cómodo si tienes conectado Heroku con GitHub.

## 4.1 Trabajar en VS Code

Abre el proyecto `shopp-server` en VS Code y modifica los archivos que necesites.

Después prueba el servidor en local:

```bash
npm install
npm start
```

O, si usas `nodemon`:

```bash
npm run dev
```

Comprueba que el servidor arranca correctamente en local.

---

## 4.2 Guardar cambios en Git

Desde la terminal de VS Code, dentro de la carpeta `shopp-server`:

```bash
git status
```

Añade los cambios:

```bash
git add .
```

Crea un commit:

```bash
git commit -m "Actualiza servidor shopp-server"
```

Sube los cambios a GitHub:

```bash
git push origin main
```

---

## 4.3 Despliegue automático en Heroku

Si en Heroku tienes configurado el despliegue automático desde GitHub:

```text
Heroku Dashboard
→ Tu app
→ Deploy
→ GitHub
→ Enable Automatic Deploys
```

Entonces, al hacer:

```bash
git push origin main
```

Heroku detectará el cambio en GitHub y desplegará automáticamente la nueva versión.

---

# 5. Comprobar logs en Heroku

Después de subir los cambios, revisa los logs:

```bash
heroku logs --tail --app nombre-de-tu-app
```

Ejemplo:

```bash
heroku logs --tail --app shopp-server
```

O si tu app tiene un nombre generado por Heroku:

```bash
heroku logs --tail --app shopp-server-7aaea79b71f2
```

Debes buscar mensajes como:

```text
Servidor escuchando en puerto XXXXX
```

Errores típicos a vigilar:

```text
Error R10
Application crashed
Cannot find module
EADDRINUSE
Error: listen EADDRINUSE
```

---

# 6. Despliegue manual con Heroku CLI

Si no quieres usar el despliegue automático desde GitHub, puedes desplegar manualmente con Heroku CLI.

## 6.1 Comprobar Heroku CLI

```bash
heroku --version
```

Si no has iniciado sesión:

```bash
heroku login
```

---

## 6.2 Comprobar remotes de Git

Dentro de la carpeta `shopp-server`:

```bash
git remote -v
```

Deberías ver algo parecido a esto:

```text
origin  https://github.com/tu-usuario/shopp-server.git
heroku  https://git.heroku.com/nombre-de-tu-app.git
```

Si no aparece el remote `heroku`, añádelo:

```bash
heroku git:remote -a nombre-de-tu-app
```

Ejemplo:

```bash
heroku git:remote -a shopp-server-7aaea79b71f2
```

---

## 6.3 Subir cambios manualmente a Heroku

Primero guarda y sube los cambios a GitHub:

```bash
git status
git add .
git commit -m "Actualiza shopp-server"
git push origin main
```

Después despliega en Heroku:

```bash
git push heroku main
```

Si tu rama local no se llama `main`, sino `master`, usa:

```bash
git push heroku master
```

---

# 7. Variables de entorno en Heroku

No guardes claves sensibles dentro del código.

En Heroku se usan variables de entorno, llamadas **Config Vars**.

Para ver las variables actuales:

```bash
heroku config --app nombre-de-tu-app
```

Para añadir una variable:

```bash
heroku config:set NOMBRE_VARIABLE="valor" --app nombre-de-tu-app
```

Ejemplos útiles:

```bash
heroku config:set NODE_ENV=production --app nombre-de-tu-app
```

```bash
heroku config:set CORS_ORIGIN="https://tu-app.netlify.app" --app nombre-de-tu-app
```

Si usas PostgreSQL en Heroku, normalmente Heroku crea automáticamente la variable:

```text
DATABASE_URL
```

Puedes comprobarlo con:

```bash
heroku config --app nombre-de-tu-app
```

---

# 8. Conexión desde la app Shopp en Netlify

En producción, la app frontend no debe apuntar a:

```env
EXPO_PUBLIC_SOCKET_URL=http://localhost:3000
```

Eso solo sirve en local.

En Netlify o producción debe apuntar a la URL pública de Heroku:

```env
EXPO_PUBLIC_SOCKET_URL=https://nombre-de-tu-app.herokuapp.com
```

Ejemplo:

```env
EXPO_PUBLIC_SOCKET_URL=https://shopp-server-7aaea79b71f2.herokuapp.com
```

Después de cambiar variables de entorno en Netlify, normalmente tendrás que hacer un nuevo deploy del frontend.

---

# 9. Añadir una ruta de prueba en el servidor

Para comprobar que el servidor está vivo desde el navegador, puedes añadir esta ruta en Express:

```js
app.get("/", (req, res) => {
  res.send("shopp-server funcionando");
});
```

Así, al abrir:

```text
https://nombre-de-tu-app.herokuapp.com
```

deberías ver:

```text
shopp-server funcionando
```

Esto no prueba todo Socket.IO, pero sí confirma que el servidor HTTP está arrancado.

---

# 10. Checklist rápido de actualización

Cada vez que hagas cambios en `shopp-server`, sigue este orden:

```bash
npm start
```

Si funciona en local:

```bash
git status
git add .
git commit -m "Describe el cambio realizado"
git push origin main
```

Si usas deploy automático desde GitHub, espera a que Heroku despliegue.

Luego revisa logs:

```bash
heroku logs --tail --app nombre-de-tu-app
```

Si usas despliegue manual:

```bash
git push heroku main
```

Y después:

```bash
heroku logs --tail --app nombre-de-tu-app
```

---

# 11. Flujo recomendado para Shopp

Para tu proyecto, el flujo más limpio sería:

```text
1. Modificar shopp-server en VS Code
2. Probar localmente con npm start
3. Hacer commit
4. Subir a GitHub con git push origin main
5. Dejar que Heroku despliegue automáticamente
6. Revisar logs con heroku logs --tail
7. Probar la app Shopp conectando con la URL pública de Heroku
```

Comandos habituales:

```bash
git status
git add .
git commit -m "Actualiza servidor socket"
git push origin main
heroku logs --tail --app nombre-de-tu-app
```

---

# 12. Problemas habituales

## El servidor funciona en local pero no en Heroku

Revisa que uses:

```js
const PORT = process.env.PORT || 3000;
```

## Heroku dice `Cannot find module`

Revisa que `package.json` tenga bien el script:

```json
{
  "scripts": {
    "start": "node index.js"
  }
}
```

Y que el archivo `index.js` exista realmente.

## La app de Netlify no conecta con el socket

Revisa la variable:

```env
EXPO_PUBLIC_SOCKET_URL=https://nombre-de-tu-app.herokuapp.com
```

No uses `localhost` en producción.

## Error de CORS

Revisa que tu servidor permita el origen de Netlify.

Ejemplo básico:

```js
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
});
```

Y en Heroku:

```bash
heroku config:set CORS_ORIGIN="https://tu-app.netlify.app" --app nombre-de-tu-app
```

---

# 13. Resumen final

Para actualizar `shopp-server` en Heroku desde VS Code:

```bash
git status
git add .
git commit -m "Actualiza shopp-server"
git push origin main
```

Si tienes despliegue automático desde GitHub, Heroku se actualizará solo.

Si quieres desplegar manualmente:

```bash
git push heroku main
```

Y para revisar el resultado:

```bash
heroku logs --tail --app nombre-de-tu-app
```
