#  KitBit – Sistema de Cobros con Criptomonedas

KitBit es una aplicación web que permite **gestionar cobros utilizando criptomonedas**, registrar vendedores y enviar notificaciones automáticas mediante SMS.

El sistema integra servicios externos como **Bitso** para operaciones con criptomonedas y **Twilio** para notificaciones.

---

# 📌 Tabla de Contenidos

- Descripción
- Características
- Tecnologías
- Arquitectura del Proyecto
- Instalación
- Configuración
- Uso
- Seguridad
- Autor

---

# 📖 Descripción

KitBit funciona como un **sistema de cobro digital**, donde un vendedor puede generar un pago y el sistema procesa la operación utilizando criptomonedas.

El backend se encarga de la lógica del sistema y comunicación con APIs externas, mientras que el frontend permite interactuar con el sistema desde el navegador.

---

# ⚙️ Características

- Registro de vendedores
- Generación de cobros
- Consulta de precios de criptomonedas
- Validación de montos de pago
- Registro de transacciones
- Integración con Bitso API
- Notificaciones SMS con Twilio
- Gestión de suscripciones

---

# 🧰 Tecnologías

- **Node.js**
- **Express**
- **JavaScript**
- **HTML / CSS**
- **Bitso API**
- **Twilio API**

---

# 🏗 Arquitectura del Proyecto

```
kitbit
│
├── backend
│   ├── middleware
│   │   └── validarMonto.js
│   │
│   ├── routes
│   │   ├── pago.js
│   │   ├── precio.js
│   │   ├── registro.js
│   │   ├── sms-entrada.js
│   │   └── suscripciones.js
│   │
│   ├── services
│   │   ├── bitso.js
│   │   ├── twilio.js
│   │   ├── wallet.js
│   │   └── logger.js
│   │
│   ├── store
│   │   ├── cobros.js
│   │   ├── suscripciones.js
│   │   └── vendedores.js
│   │
│   └── server.js
│
└── frontend
    ├── index.html
    ├── cobro.html
    ├── script.js
    └── styles.css
```

---

# 💻 Instalación

### 1. Clonar el repositorio

```
git clone https://github.com/tuusuario/kitbit.git
```

### 2. Entrar al proyecto

```
cd kitbit
```

### 3. Instalar dependencias

```
npm install
```

### 4. Ejecutar el servidor

```
npm run dev
```

---

# 🔐 Configuración

Crear un archivo `.env` dentro de la carpeta **backend**.

Ejemplo:

```
PORT=3000

TWILIO_ACCOUNT_SID=tu_sid
TWILIO_AUTH_TOKEN=tu_token

BITSO_API_KEY=tu_api_key
BITSO_API_SECRET=tu_api_secret

API_SECRET_KEY=clave_segura_de_32_caracteres
```

⚠️ Nunca subas tu archivo `.env` a GitHub.

---

# ▶ Uso

1. Ejecutar el servidor con:

```
npm run dev
```

2. Abrir en el navegador:

```
frontend/index.html
```

3. Registrar vendedores y generar cobros.

---

# 🔒 Seguridad

Para mantener el sistema seguro:

- Usar variables de entorno para credenciales
- No subir `.env` al repositorio
- Utilizar claves seguras para `API_SECRET_KEY`

---

# 👨‍💻 Autores

**Humberto Ramírez Gruintal**
**Cristopher Maximiliano Euan pool**
**Alexander Fabrizio Rodriguez Pérez**

Proyecto académico enfocado en la integración de pagos con criptomonedas y servicios de notificación.

---