# Tic Tac Toe Pixel - Multijugador online

Tres en raya en tiempo real con estetica pixel art. Dos jugadores entran
desde el navegador (celular o PC) mediante un codigo de sala de 4 letras.
Incluye reacciones con emojis (sin chat).

## Stack
- Node.js + Express + Socket.IO (tiempo real)
- Canvas 500x500 con sprites pixel art, fuente Press Start 2P
- Dockerfile listo para Cloud Run

## Prueba local
    npm install
    npm start
Abre http://localhost:3000 en dos pestanas (o dos dispositivos en la misma red).

## Deploy en Google Cloud Run

1. Crea un proyecto en https://console.cloud.google.com y habilita las APIs
   "Cloud Run" y "Artifact Registry".

2. Instala gcloud CLI e inicia sesion:
       gcloud auth login
       gcloud config set project TU_PROYECTO

3. Despliega con un solo comando (construye la imagen y la publica):
       gcloud run deploy tictactoe-pixel --source . --region us-central1 --allow-unauthenticated

4. Al finalizar te da una URL tipo:
       https://tictactoe-pixel-xxx-uc.a.run.app
   Compartela: cada jugador abre el link, uno crea partida y pasa el codigo.

Notas:
- Cloud Run escala a 0 cuando nadie juega: el primer acceso tarda ~5s en
  arrancar (cold start). Conexion por WebSockets soportada.
- El puerto lo inyecta Cloud Run en $PORT; el servidor ya lo respeta.

## Reacciones
Boton "REACCION" en la partida: panel con 8 emojis (👍 😂 😮 😢 😡 👏 🤔 😤).
El servidor valida la lista permitida y reenvia a ambos jugadores con
cooldown de 1.2s anti-spam.
