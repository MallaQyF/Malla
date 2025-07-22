// Importa las funciones necesarias de los SDK de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ====================================================================================
// IMPORTANTE: CONFIGURACIÓN DE FIREBASE
// Las variables __app_id, __firebase_config y __initial_auth_token son proporcionadas por el entorno de Canvas.
// No las modifiques.
// ====================================================================================
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
// Se ha actualizado la configuración de Firebase con los valores proporcionados por el usuario.
// Si estás en un entorno como Canvas que provee __firebase_config, se usará esa.
// De lo contrario, se usará la configuración hardcodeada (asegúrate de reemplazar TU_NUEVA_CLAVE_API_PEGA_AQUI).
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyDda-katxXY1NvhG-DYwIRp2Kb75hi1J2w", // <--- ¡Pega aquí la nueva clave que copiaste de Google Cloud!
  authDomain: "malla2.firebaseapp.com",
  projectId: "malla2",
  storageBucket: "malla2.firebasestorage.app",
  messagingSenderId: "14295791854",
  appId: "1:14295791854:web:009a315e98188f07a35bff",
  measurementId: "G-8KGLXVMZ98"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// --- Referencias del DOM ---
const ramos = document.querySelectorAll('.ramo');
const buscador = document.getElementById('buscador');
const areaFilter = document.getElementById('area-filter');
const zoomRange = document.getElementById('zoom');
const clockElement = document.getElementById('clock');
const themeSelector = document.getElementById('theme-selector');
const mallaContainer = document.getElementById('malla-container');

// Elementos de la UI de Autenticación
const loginBtn = document.getElementById('login-btn');
const loginDropdown = document.getElementById('login-dropdown');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const googleLoginBtn = document.getElementById('google-login-btn');
const createAccountLink = document.getElementById('create-account-link');
const userInfoDiv = document.getElementById('user-info');
const userNameSpan = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');

// Elementos del Modal de Registro
const registerModal = document.getElementById('register-modal');
const registerEmailInput = document.getElementById('register-email');
const registerPasswordInput = document.getElementById('register-password');
const registerSubmitBtn = document.getElementById('register-submit-btn');
const googleRegisterBtn = document.getElementById('google-register-btn');

// Otros Modales
const ramoInfoModal = document.getElementById('ramo-info-modal');
const customConfirmModal = document.getElementById('custom-confirm-modal');
const trNicoMessageModal = document.getElementById('tr-nico-message-modal');
const semesterCompleteModal = document.getElementById('semester-complete-modal');

// --- Variables de Estado ---
let currentUser = null;
let aprobados = new Set();
let completedSem = new Set();
let completedYear = new Set();
const totalRamos = ramos.length;

// --- Funciones de Persistencia de Datos (Firebase y LocalStorage) ---

/**
 * Guarda los datos del usuario (ramos aprobados, semestres/años completados, tema)
 * en Firestore si hay un usuario autenticado, o en LocalStorage como fallback.
 */
async function saveUserData() {
    if (!currentUser) {
        // Si no hay usuario logueado, guarda en localStorage
        localStorage.setItem('aprobados', JSON.stringify([...aprobados]));
        localStorage.setItem('completedSem', JSON.stringify([...completedSem]));
        localStorage.setItem('completedYear', JSON.stringify([...completedYear]));
        localStorage.setItem('theme', themeSelector.value);
        return;
    }
    try {
        // Ruta de colección para datos privados del usuario
        // Se ha ajustado la ruta para usar el appId proporcionado por el entorno
        const userDocRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/data/progress`);
        const dataToSave = {
            aprobados: [...aprobados],
            completedSem: [...completedSem],
            completedYear: [...completedYear],
            theme: themeSelector.value
        };
        await setDoc(userDocRef, dataToSave);
    } catch (error) {
        console.error("Error al guardar los datos del usuario en Firestore: ", error);
        showCustomAlert("Error al guardar tu progreso en la nube.");
    }
}

/**
 * Carga los datos del usuario desde Firestore si hay un usuario autenticado,
 * o desde LocalStorage como fallback.
 */
async function loadUserData() {
    if (!currentUser) {
        // Carga desde localStorage si no hay usuario
        loadLocalData();
        updateUI();
        return;
    }

    // Ruta de colección para datos privados del usuario
    // Se ha ajustado la ruta para usar el appId proporcionado por el entorno
    const userDocRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/data/progress`);
    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            aprobados = new Set(data.aprobados || []);
            completedSem = new Set(data.completedSem || []);
            completedYear = new Set(data.completedYear || []);
            setTheme(data.theme || 'light');
        } else {
            // No se encontraron datos para este usuario, inicia fresco
            aprobados = new Set();
            completedSem = new Set();
            completedYear = new Set();
            setTheme('light');
        }
    } catch (error) {
        console.error("Error al cargar los datos del usuario desde Firestore: ", error);
        showCustomAlert("Error al cargar tu progreso desde la nube.");
        // Fallback a almacenamiento local en caso de error
        loadLocalData();
    }
    updateUI();
}

/**
 * Carga los datos de progreso desde LocalStorage.
 */
function loadLocalData() {
    aprobados = new Set(JSON.parse(localStorage.getItem('aprobados')) || []);
    completedSem = new Set(JSON.parse(localStorage.getItem('completedSem')) || []);
    completedYear = new Set(JSON.parse(localStorage.getItem('completedYear')) || []);
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

// --- Manejador de Cambio de Estado de Autenticación ---

// Se ejecuta cada vez que el estado de autenticación del usuario cambia
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        // Usuario ha iniciado sesión
        userNameSpan.textContent = user.displayName || user.email;
        loginBtn.style.display = 'none';
        loginDropdown.classList.remove('show');
        userInfoDiv.style.display = 'flex';
    } else {
        // Usuario ha cerrado sesión
        loginBtn.style.display = 'block';
        userInfoDiv.style.display = 'none';
    }
    // Carga los datos del usuario después de que el estado de autenticación se ha establecido
    await loadUserData();
});

// --- Funciones de Actualización de UI y Tema ---

/**
 * Establece el tema de la aplicación.
 * @param {string} themeName - El nombre del tema ('light', 'dark', 'pastel', etc.).
 */
function setTheme(themeName) {
    document.body.className = ''; // Limpia todas las clases existentes
    document.body.classList.add(themeName);
    themeSelector.value = themeName;
}

// Event listener para cambiar el tema
themeSelector.addEventListener('change', (e) => {
  setTheme(e.target.value);
  saveUserData(); // Guarda el cambio de tema
});

// --- Event Listeners para Autenticación ---

// Muestra/oculta el dropdown de inicio de sesión
loginBtn.addEventListener('click', () => {
    loginDropdown.classList.toggle('show');
});

// Cierra el dropdown si se hace clic fuera de él
document.addEventListener('click', (e) => {
    if (!loginBtn.contains(e.target) && !loginDropdown.contains(e.target)) {
        loginDropdown.classList.remove('show');
    }
});

// Abre el modal de registro al hacer clic en el enlace "Crea una aquí"
createAccountLink.addEventListener('click', () => {
    loginDropdown.classList.remove('show');
    showModal('register-modal');
});

// Inicio de sesión con Email/Contraseña
loginSubmitBtn.addEventListener('click', async () => {
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;
    if (!email || !password) {
        showCustomAlert("Por favor, ingresa correo y contraseña.");
        return;
    }
    try {
        await signInWithEmailAndPassword(auth, email, password);
        loginDropdown.classList.remove('show');
    } catch (error) {
        console.error("Error de inicio de sesión:", error);
        showCustomAlert("Error al iniciar sesión: " + error.message);
    }
});

// Registro con Email/Contraseña
registerSubmitBtn.addEventListener('click', async () => {
    const email = registerEmailInput.value;
    const password = registerPasswordInput.value;
    if (!email || !password) {
        showCustomAlert("Por favor, ingresa correo y contraseña.");
        return;
    }
    if (password.length < 6) {
        showCustomAlert("La contraseña debe tener al menos 6 caracteres.");
        return;
    }
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        closeModal('register-modal');
    } catch (error) {
        console.error("Error de registro:", error);
        showCustomAlert("Error al registrarse: " + error.message);
    }
});

// Google Sign-In (for both login and register)
const handleGoogleSignIn = async () => {
    try {
        await signInWithPopup(auth, googleProvider);
        loginDropdown.classList.remove('show');
        closeModal('register-modal');
    } catch (error) {
        console.error("Error de inicio de sesión con Google:", error);
        if (error.code === 'auth/unauthorized-domain') {
             showCustomAlert(`Error: El dominio desde el que intentas acceder no está autorizado. Por favor, agrega '${location.hostname}' a la lista de dominios autorizados en tu configuración de Firebase Authentication.`);
        } else {
            showCustomAlert("Error con el inicio de sesión de Google: " + error.message);
        }
    }
};
googleLoginBtn.addEventListener('click', handleGoogleSignIn);
googleRegisterBtn.addEventListener('click', handleGoogleSignIn);

// Cierre de sesión
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        showCustomAlert("Error al cerrar sesión.");
    }
});

// --- Lógica del Reloj ---
function updateClock(){
  const now = new Date();
  const timeString = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateString = now.toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  clockElement.innerHTML = `<div class="time">${timeString}</div><div class="date">${dateString}</div>`;
}
setInterval(updateClock,1000);
updateClock();

// --- Lógica de Zoom ---
zoomRange.addEventListener('input', e => {
  mallaContainer.style.transform = `scale(${e.target.value/100})`;
});
mallaContainer.style.transform = `scale(${zoomRange.value/100})`;

/**
 * Elimina un ramo y sus dependientes de la lista de aprobados.
 * @param {string} code - El código del ramo a desmarcar.
 */
async function cascadeRemove(code){
  aprobados.delete(code);
  const dependentRamos = document.querySelectorAll(`.ramo[data-req*="${code}"]`);
  for (const r of dependentRamos) {
    if (aprobados.has(r.dataset.code)) {
      await cascadeRemove(r.dataset.code);
    }
  }
}

// Créditos totales requeridos por área
const CREDITOS_TOTALES_POR_AREA = {
    espiritual: 14,
    general: 22,
    profesional: 166,
    especialidad: 50,
    practica: 46
};

/**
 * Actualiza la interfaz de usuario: progreso de ramos, semestres, años y créditos por área.
 */
function updateUI(){
  let totalCreditosAprobados = 0;
  let creditosPorArea = { espiritual: 0, general: 0, profesional: 0, especialidad: 0, practica: 0 };

  document.querySelectorAll('.semestre').forEach(s=>{
    const hijos = s.querySelectorAll('.ramo');
    const progressFill = s.querySelector('.progress-fill');
    if (!progressFill) return;

    let aprobadosEnSemestre = 0;
    hijos.forEach(r=>{
      const code = r.dataset.code;
      const dependencies = r.dataset.req ? r.dataset.req.split(',') : [];
      r.classList.remove('aprobado','desbloqueado','highlight');

      if(aprobados.has(code)){
        r.classList.add('aprobado');
        aprobadosEnSemestre++;
        const creditos = parseInt(r.dataset.creditos);
        const area = r.dataset.area;
        if (!isNaN(creditos)) {
            totalCreditosAprobados += creditos;
            if (creditosPorArea[area] !== undefined) {
                creditosPorArea[area] += creditos;
            }
        }
      } else if(dependencies.length > 0 && dependencies.every(q => aprobados.has(q))){
        r.classList.add('desbloqueado');
      }
    });

    progressFill.style.width = hijos.length > 0 ? (aprobadosEnSemestre / hijos.length * 100) + '%' : '0%';
    
    const semesterNumber = s.dataset.sem;
    if(aprobadosEnSemestre === hijos.length && hijos.length > 0 && !completedSem.has(semesterNumber)){
      showSemesterCompleteModal(`¡Felicidades, sobreviviste al ${semesterNumber}° semestre!`);
      completedSem.add(semesterNumber);
      saveUserData();
    }
  });

  document.getElementById('contador').textContent = Math.round(aprobados.size / totalRamos * 100) + '%';
  document.getElementById('creditos-total').textContent = totalCreditosAprobados;

  // Actualiza los créditos por área en la leyenda
  for (const area in creditosPorArea) {
      const span = document.getElementById(`creditos-${area}`);
      const total = CREDITOS_TOTALES_POR_AREA[area];
      const current = creditosPorArea[area];
      span.textContent = `${current}/${total}`;
      
      const row = document.querySelector(`#legend tr[data-area="${area}"] td`);
      if (current >= total) {
          row.classList.add('area-completed');
      } else {
          row.classList.remove('area-completed');
      }
  }

  // Comprueba y marca años completados
  document.querySelectorAll('.year').forEach(y=>{
    const yearNumber = y.dataset.year;
    const semestersInYear = y.querySelectorAll('.semestre:not(.empty)');
    const allSemestersComplete = [...semestersInYear].every(s => parseFloat(s.querySelector('.progress-fill').style.width) === 100);
    
    if (allSemestersComplete) {
        y.setAttribute('data-year-complete','');
        if(!completedYear.has(yearNumber)) {
            showSemesterCompleteModal(`¡Felicidades, completaste el ${yearNumber}° año!`);
            completedYear.add(yearNumber);
            saveUserData();
        }
    } else {
        y.removeAttribute('data-year-complete');
    }
  });
}

/**
 * Muestra el modal de información de un ramo específico.
 * @param {HTMLElement} ramoElement - El elemento HTML del ramo.
 */
function showRamoInfoModal(ramoElement) {
    const code = ramoElement.dataset.code;
    ramoInfoModal.querySelector('#modal-ramo-nombre').textContent = ramoElement.textContent.trim();
    ramoInfoModal.querySelector('#modal-ramo-code').textContent = code;
    ramoInfoModal.querySelector('#modal-ramo-area').textContent = ramoElement.dataset.area;
    ramoInfoModal.querySelector('#modal-ramo-creditos').textContent = ramoElement.dataset.creditos || 'N/A';
    const reqRamo = document.querySelector(`.ramo[data-code="${ramoElement.dataset.req}"]`);
    ramoInfoModal.querySelector('#modal-ramo-req').textContent = reqRamo ? reqRamo.textContent.trim() : (ramoElement.dataset.req || 'Ninguno');
    ramoInfoModal.querySelector('#modal-ramo-desc').textContent = ramoElement.dataset.desc || 'No hay descripción.';
    
    if (aprobados.has(code)) {
        ramoInfoModal.querySelector('#modal-btn-aprobado').style.display = 'none';
        ramoInfoModal.querySelector('#modal-btn-desmarcar').style.display = 'inline-block';
    } else {
        ramoInfoModal.querySelector('#modal-btn-aprobado').style.display = 'inline-block';
        ramoInfoModal.querySelector('#modal-btn-desmarcar').style.display = 'none';
    }
    
    ramoInfoModal.dataset.currentCode = code;
    showModal('ramo-info-modal');
}

// Asigna el evento click a cada ramo para mostrar su información
ramos.forEach(r => r.onclick = () => showRamoInfoModal(r));

// Event listener para el botón "Marcar como Aprobado" en el modal de ramo
ramoInfoModal.querySelector('#modal-btn-aprobado').addEventListener('click', async () => {
    const code = ramoInfoModal.dataset.currentCode;
    const ramoElement = document.querySelector(`.ramo[data-code="${code}"]`);
    const dependencies = ramoElement.dataset.req ? ramoElement.dataset.req.split(',') : [];

    // Comprueba si todos los prerrequisitos están aprobados
    if (dependencies.length === 0 || dependencies.every(q => aprobados.has(q))) {
        aprobados.add(code);
        await saveUserData();
        updateUI();
        closeModal('ramo-info-modal');
    } else {
        const faltante = dependencies.find(q => !aprobados.has(q));
        const nombreFaltante = document.querySelector(`.ramo[data-code="${faltante}"]`).textContent;
        showCustomAlert(`Aún no has aprobado "${nombreFaltante.trim()}" para tomar este ramo.`);
    }
});

// Event listener para el botón "Desmarcar" en el modal de ramo
ramoInfoModal.querySelector('#modal-btn-desmarcar').addEventListener('click', async () => {
    const code = ramoInfoModal.dataset.currentCode;
    await cascadeRemove(code); // Desmarca el ramo y sus dependientes
    await saveUserData();
    updateUI();
    closeModal('ramo-info-modal');
});

/**
 * Reinicia todo el progreso del usuario.
 */
function reset() {
  showCustomConfirm('¿Estás seguro de que quieres reiniciar todo el progreso? Esto no se puede deshacer.', async () => {
    aprobados.clear();
    completedSem.clear();
    completedYear.clear();
    await saveUserData();
    updateUI();
    closeModal('custom-confirm-modal');
  });
}
document.getElementById('reset-btn').addEventListener('click', reset);

// --- Gestión de Modales ---
/**
 * Muestra un modal específico.
 * @param {string} modalId - El ID del modal a mostrar.
 */
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) modal.classList.add('show');
}

/**
 * Cierra un modal específico.
 * @param {string} modalId - El ID del modal a cerrar.
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) modal.classList.remove('show');
}

/**
 * Muestra un modal de alerta personalizado.
 * @param {string} message - El mensaje a mostrar.
 * @param {string} [title="Información"] - El título del modal.
 */
function showCustomAlert(message, title = "Información") {
    const alertModal = document.getElementById('tr-nico-message-modal');
    alertModal.querySelector('.modal-title').textContent = title;
    alertModal.querySelector('p').textContent = message;
    showModal('tr-nico-message-modal');
}

/**
 * Muestra una alerta auto-cerrable en la parte superior de la pantalla.
 * @param {string} message - El mensaje a mostrar.
 * @param {number} [duration=3000] - Duración en milisegundos antes de que la alerta se oculte.
 */
function showAutoCloseAlert(message, duration = 3000) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'auto-close-alert';
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.classList.add('hide');
        setTimeout(() => {
            if (document.body.contains(alertDiv)) {
                document.body.removeChild(alertDiv);
            }
        }, 500); // Espera la transición de desvanecimiento
    }, duration);
}

/**
 * Muestra un modal de confirmación personalizado.
 * @param {string} message - El mensaje de confirmación.
 * @param {Function} onConfirm - La función a ejecutar si el usuario confirma.
 */
function showCustomConfirm(message, onConfirm) {
    const confirmModal = document.getElementById('custom-confirm-modal');
    confirmModal.querySelector('#confirm-message').textContent = message;
    const yesBtn = confirmModal.querySelector('#confirm-reset-yes');
    
    // Clona el botón para remover event listeners anteriores
    const newYesBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
    newYesBtn.addEventListener('click', onConfirm);

    showModal('custom-confirm-modal');
}

/**
 * Muestra un modal de felicitaciones cuando un semestre o año es completado.
 * @param {string} message - El mensaje de felicitación.
 */
function showSemesterCompleteModal(message) {
    semesterCompleteModal.querySelector('#semester-complete-message').textContent = message;
    showModal('semester-complete-modal');
}

// --- Configura los comportamientos de cierre para todos los modales ---
document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) { // Cierra si se hace clic fuera del contenido del modal
            closeModal(modal.id);
        }
    });
    // Cierra el modal al hacer clic en el botón de cerrar o en el botón "No, cancelar"
    modal.querySelectorAll('.modal-close-button, .btn-close, #confirm-reset-no').forEach(btn => {
        btn.addEventListener('click', () => closeModal(modal.id));
    });
});

// Event listener para el botón de información del "tr._nico"
document.getElementById('tr-nico-info-btn').addEventListener('click', () => {
    showCustomAlert("Regalito del tr._nico para mis compañeros químicos farmacéuticos.", "Mensaje Especial");
});

// --- Lógica de Filtrado y Búsqueda ---
/**
 * Normaliza una cadena de texto para la búsqueda (minúsculas, sin acentos).
 * @param {string} s - La cadena a normalizar.
 * @returns {string} La cadena normalizada.
 */
const normalize = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

/**
 * Filtra los ramos según el texto de búsqueda y el área seleccionada.
 */
function filterRamos(){
  const query = normalize(buscador.value);
  const area = areaFilter.value;
  ramos.forEach(r=>{
    const text = normalize(r.textContent);
    const ramoArea = r.dataset.area;
    const isVisible = (!query || text.includes(query)) && (!area || ramoArea === area);
    r.style.display = isVisible ? '' : 'none';
    r.classList.toggle('highlight', isVisible && (query !== '' || area !== ''));
  });
}
buscador.addEventListener('input', filterRamos);
areaFilter.addEventListener('change', filterRamos);

// --- Lógica para el menú desplegable de Guardar/Exportar ---
document.getElementById('export-json-btn').addEventListener('click', () => {
    const dataToExport = {
        aprobados: [...aprobados],
        theme: themeSelector.value,
        completedSem: [...completedSem],
        completedYear: [...completedYear]
    };
    const dataStr = JSON.stringify(dataToExport);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'progreso_malla_unach.json';
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
    showAutoCloseAlert('Progreso exportado exitosamente.');
});

document.getElementById('import-json-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => { // Añadir 'async' aquí
        try {
            const data = JSON.parse(e.target.result);
            if (data && Array.isArray(data.aprobados)) {
                aprobados = new Set(data.aprobados);
                completedSem = new Set(data.completedSem || []);
                completedYear = new Set(data.completedYear || []);
                setTheme(data.theme || 'light');
                await saveUserData(); // Guardar los datos importados en Firebase/LocalStorage
                updateUI();
                showAutoCloseAlert('Progreso importado exitosamente.');
            } else {
                showCustomAlert('El archivo de progreso no es válido.');
            }
        } catch (error) {
            showCustomAlert('Error al leer el archivo.');
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Resetea el input del archivo
});

// ====================================================================================
// ======= LÓGICA DE EXPORTACIÓN A PDF MEJORADA =======
// ====================================================================================

/**
 * Convierte una imagen de URL a Base64.
 * @param {string} url - La URL de la imagen.
 * @returns {Promise<string>} La imagen en formato Base64.
 */
const imageToBase64 = async (url) => {
    try {
        // Añadir un parámetro anti-caché a la URL
        const cacheBustingUrl = `${url}?v=${new Date().getTime()}`;
        const response = await fetch(cacheBustingUrl, { cache: 'no-store' });
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error al convertir imagen a Base64:", error);
        return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // Pixel transparente como fallback
    }
};

document.getElementById('export-pdf-btn').addEventListener('click', async () => {
    const exportButton = document.getElementById('export-pdf-btn');
    showCustomAlert("Generando PDF, por favor espera...", "Exportando");
    exportButton.disabled = true; // Deshabilita el botón durante la exportación

    const exportContainer = document.createElement('div');
    exportContainer.id = 'pdf-export-container';
    
    // Estilos para el contenedor de exportación (oculto y con tamaño fijo para la captura)
    Object.assign(exportContainer.style, {
        position: 'absolute',
        left: '-9999px', // Mueve el contenedor fuera de la vista
        top: '0px',
        padding: '40px',
        backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg'),
        color: getComputedStyle(document.body).getPropertyValue('--text'),
        width: '1900px' // Ancho fijo para la captura
    });
    
    document.body.appendChild(exportContainer);

    // Crea el encabezado para el PDF
    const headerElement = document.createElement('div');
    const logoImg = document.querySelector('#header-left img');
    
    // Convierte el logo a Base64 para incrustarlo en el PDF
    const logoBase64 = await imageToBase64(logoImg.src);

    const titleText = document.querySelector('#header-title').textContent.trim();
    const universityText = document.querySelector('#university-name').textContent.trim();
    headerElement.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 2px solid var(--accent);">
            <img src="${logoBase64}" style="height: 60px;">
            <div style="text-align: center;">
                <h1 style="font-family: 'Playfair Display', serif; font-size: 2.2em; color: var(--accent); margin: 0;">${titleText}</h1>
                <h2 style="font-family: 'Inter', sans-serif; font-size: 1.1em; font-weight: 600; margin: 5px 0 0 0;">${universityText}</h2>
            </div>
            <div style="width: 60px;"></div> <!-- Espaciador para alinear el título central -->
        </div>
    `;
    exportContainer.appendChild(headerElement);

    // Clona la malla y la añade al contenedor de exportación con estilos específicos para PDF
    const mallaOriginal = document.getElementById('malla');
    const mallaCloned = mallaOriginal.cloneNode(true);
    mallaCloned.id = 'malla-cloned-for-export';
    mallaCloned.classList.add('malla-for-export'); // Clase para estilos de exportación
    exportContainer.appendChild(mallaCloned);

    // Añade información adicional al pie del PDF
    const infoContainer = document.createElement('div');
    infoContainer.style.display = 'flex';
    infoContainer.style.justifyContent = 'space-between';
    infoContainer.style.alignItems = 'flex-start';
    infoContainer.style.marginTop = '20px';
    
    const legendCloned = document.getElementById('legend').cloneNode(true);
    legendCloned.style.margin = '0'; // Elimina márgenes de la leyenda clonada
    infoContainer.appendChild(legendCloned);

    const creditosText = document.getElementById('creditos-info').textContent.trim();
    const selectedThemeOption = themeSelector.options[themeSelector.selectedIndex];
    const themeText = `Tema: ${selectedThemeOption.text}`;
    const dateText = `Fecha: ${new Date().toLocaleString('es-CL')}`;
    const footerInfo = document.createElement('div');
    footerInfo.style.textAlign = 'right';
    footerInfo.innerHTML = `
            <p style="font-size: 1em; font-weight: 600; margin: 0 0 5px 0;">${creditosText}</p>
            <p style="font-size: 1em; margin: 0 0 5px 0;">${themeText}</p>
            <p style="font-size: 1em; margin: 0;">${dateText}</p>
        `;
        infoContainer.appendChild(footerInfo);
        exportContainer.appendChild(infoContainer);

        const { jsPDF } = window.jspdf; // Accede a jsPDF desde el objeto global window
        try {
            // Renderiza el contenedor de exportación a un canvas
            const canvas = await html2canvas(exportContainer, {
                scale: 2, // Aumenta la escala para mejor calidad
                useCORS: true,
                allowTaint: true,
                logging: false
            });

            const imgData = canvas.toDataURL('image/png'); // Obtiene la imagen en Base64
            const doc = new jsPDF({
                orientation: 'landscape', // Orientación horizontal
                unit: 'px',
                format: [canvas.width, canvas.height] // Usa el tamaño del canvas para el formato del PDF
            });

            doc.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height); // Añade la imagen al PDF
            doc.save('Malla-UNACH-Progreso.pdf'); // Guarda el PDF
            
            showAutoCloseAlert('¡Tu malla se ha descargado con éxito!');

        } catch (error) {
            console.error("Error al exportar a PDF:", error);
            showCustomAlert("Hubo un error al generar el PDF. Asegúrate de que no haya bloqueadores de contenido activos e inténtalo de nuevo.");
        } finally {
            document.body.removeChild(exportContainer); // Limpia el contenedor de exportación
            exportButton.disabled = false; // Habilita el botón de nuevo
            closeModal('tr-nico-message-modal'); // Cierra el modal de "Exportando"
        }
    });

    // --- Lógica del Calendario ---
    const calendarGrid = document.getElementById('calendar-grid');
    const currentMonthYear = document.getElementById('current-month-year');
    let currentCalendarDate = new Date();

    /**
     * Renderiza el calendario para el mes y año actuales.
     */
    function renderCalendar() {
        const month = currentCalendarDate.getMonth();
        const year = currentCalendarDate.getFullYear();
        currentMonthYear.textContent = `${new Date(year, month).toLocaleString('es-ES', { month: 'long', year: 'numeric' })}`;
        
        calendarGrid.innerHTML = ''; // Limpia el calendario
        const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
        dayNames.forEach(day => {
            const dayNameEl = document.createElement('div');
            dayNameEl.className = 'day-name';
            dayNameEl.textContent = day;
            calendarGrid.appendChild(dayNameEl);
        });

        // Calcula el primer día de la semana del mes
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Ajusta el offset para que la semana empiece en Lunes (0=Domingo, 1=Lunes...)
        const startOffset = (firstDay === 0) ? 6 : firstDay - 1;

        // Rellena los días vacíos al principio del mes
        for (let i = 0; i < startOffset; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.classList.add('calendar-day', 'empty');
            calendarGrid.appendChild(emptyDay);
        }

        const today = new Date();
        // Rellena los días del mes
        for (let i = 1; i <= daysInMonth; i++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            dayEl.textContent = i;
            // Marca el día actual
            if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                dayEl.classList.add('current-day');
            }
            calendarGrid.appendChild(dayEl);
        }
    }

    // Event listeners para cambiar de mes en el calendario
    document.getElementById('prev-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });
    document.getElementById('next-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });

    // Renderiza el calendario al cargar la página
    renderCalendar();

    // Inicializa la UI al cargar el script
    // Esto asegura que la UI se actualice con los datos cargados (ya sea de Firebase o LocalStorage)
    // una vez que el estado de autenticación se ha resuelto.
    // La llamada a updateUI() ya está en onAuthStateChanged, así que no es necesaria aquí.
  </script>
</body>
</html>
