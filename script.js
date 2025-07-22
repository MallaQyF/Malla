// Importa las funciones necesarias de los SDK de Firebase desde la CDN oficial
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
// FUNCIÓN PRINCIPAL ASÍNCRONA
// Encapsulamos toda la lógica en una función `main` para poder cargar 
// la configuración de Firebase de forma segura antes de inicializar la app.
// ====================================================================================
async function main() {
    
    // --- 1. Carga Segura de la Configuración de Firebase ---
    let firebaseConfig;
    try {
        // Este endpoint especial '/__/firebase/init.json' es servido automáticamente por Firebase Hosting.
        // Contiene la configuración de tu proyecto de forma segura, sin exponerla en el código fuente.
        const response = await fetch('/__/firebase/init.json');
        if (!response.ok) {
            throw new Error('No se pudo obtener la configuración de Firebase. ¿Estás ejecutando en Firebase Hosting?');
        }
        firebaseConfig = await response.json();
    } catch (error) {
        console.error("CRÍTICO: No se pudo inicializar Firebase.", error);
        // Muestra un error amigable si la configuración no se puede cargar.
        // Esto suele pasar si se abre el archivo localmente en lugar de usar `firebase serve` o desplegarlo.
        document.body.innerHTML = `
            <div style="padding: 20px; text-align: center; font-family: sans-serif; color: #333;">
                <h1>Error de Configuración</h1>
                <p>No se pudo cargar la configuración de Firebase.</p>
                <p>Esta página está diseñada para funcionar cuando está publicada en <strong>Firebase Hosting</strong>.</p>
                <p>Si eres el desarrollador, usa el comando <code>firebase serve</code> para probarla localmente.</p>
            </div>
        `;
        return; // Detiene la ejecución del script si hay un error crítico.
    }

    // --- 2. Inicialización de Firebase con la Configuración Segura ---
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const googleProvider = new GoogleAuthProvider();

    // --- A PARTIR DE AQUÍ, TODO EL CÓDIGO ORIGINAL DE LA APLICACIÓN ---

    const ramos = document.querySelectorAll('.ramo');
    const buscador = document.getElementById('buscador');
    const areaFilter = document.getElementById('area-filter');
    const zoomRange = document.getElementById('zoom');
    const clockElement = document.getElementById('clock');
    const themeSelector = document.getElementById('theme-selector');
    const mallaContainer = document.getElementById('malla-container');
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
    const registerModal = document.getElementById('register-modal');
    const registerEmailInput = document.getElementById('register-email');
    const registerPasswordInput = document.getElementById('register-password');
    const registerSubmitBtn = document.getElementById('register-submit-btn');
    const googleRegisterBtn = document.getElementById('google-register-btn');
    const ramoInfoModal = document.getElementById('ramo-info-modal');
    const customConfirmModal = document.getElementById('custom-confirm-modal');
    const trNicoMessageModal = document.getElementById('tr-nico-message-modal');
    const semesterCompleteModal = document.getElementById('semester-complete-modal');

    let currentUser = null;
    let aprobados = new Set();
    let completedSem = new Set();
    let completedYear = new Set();
    const totalRamos = ramos.length;

    async function saveUserData() {
        const dataToSave = {
            aprobados: [...aprobados],
            completedSem: [...completedSem],
            completedYear: [...completedYear],
            theme: themeSelector.value
        };

        if (!currentUser) {
            for (const key in dataToSave) {
                localStorage.setItem(key, JSON.stringify(dataToSave[key]));
            }
            return;
        }
        try {
            const userDocRef = doc(db, `users/${currentUser.uid}/progress`);
            await setDoc(userDocRef, dataToSave);
        } catch (error) {
            console.error("Error al guardar datos en Firestore: ", error);
            showCustomAlert("Error al guardar tu progreso en la nube.");
        }
    }

    async function loadUserData() {
        if (!currentUser) {
            loadLocalData();
            updateUI();
            return;
        }

        const userDocRef = doc(db, `users/${currentUser.uid}/progress`);
        try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                aprobados = new Set(data.aprobados || []);
                completedSem = new Set(data.completedSem || []);
                completedYear = new Set(data.completedYear || []);
                setTheme(data.theme || 'light');
            } else {
                loadLocalData();
                await saveUserData();
            }
        } catch (error) {
            console.error("Error al cargar datos de Firestore: ", error);
            showCustomAlert("Error al cargar tu progreso. Se usarán datos locales.");
            loadLocalData();
        }
        updateUI();
    }

    function loadLocalData() {
        aprobados = new Set(JSON.parse(localStorage.getItem('aprobados')) || []);
        completedSem = new Set(JSON.parse(localStorage.getItem('completedSem')) || []);
        completedYear = new Set(JSON.parse(localStorage.getItem('completedYear')) || []);
        const savedTheme = JSON.parse(localStorage.getItem('theme')) || 'light';
        setTheme(savedTheme);
    }

    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
            userNameSpan.textContent = user.displayName || user.email;
            loginBtn.style.display = 'none';
            loginDropdown.classList.remove('show');
            userInfoDiv.style.display = 'flex';
        } else {
            loginBtn.style.display = 'block';
            userInfoDiv.style.display = 'none';
        }
        await loadUserData();
    });

    function setTheme(themeName) {
        document.body.className = '';
        if (themeName && themeName !== 'light') {
            document.body.classList.add(themeName);
        }
        themeSelector.value = themeName;
    }

    themeSelector.addEventListener('change', (e) => {
      setTheme(e.target.value);
      saveUserData();
    });

    loginBtn.addEventListener('click', () => {
        loginDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!loginBtn.contains(e.target) && !loginDropdown.contains(e.target)) {
            loginDropdown.classList.remove('show');
        }
    });

    createAccountLink.addEventListener('click', () => {
        loginDropdown.classList.remove('show');
        showModal('register-modal');
    });

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

    const handleGoogleSignIn = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            loginDropdown.classList.remove('show');
            closeModal('register-modal');
        } catch (error) {
            console.error("Error con Google Sign-In:", error);
            if (error.code === 'auth/unauthorized-domain') {
                 showCustomAlert(`Error: El dominio no está autorizado. Agrega el dominio a la lista de dominios autorizados en tu configuración de Firebase Authentication.`);
            } else {
                showCustomAlert("Error con el inicio de sesión de Google: " + error.message);
            }
        }
    };
    googleLoginBtn.addEventListener('click', handleGoogleSignIn);
    googleRegisterBtn.addEventListener('click', handleGoogleSignIn);

    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
            showCustomAlert("Error al cerrar sesión.");
        }
    });

    function updateClock(){
      const now = new Date();
      const timeString = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateString = now.toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      clockElement.innerHTML = `<div class="time">${timeString}</div><div class="date">${dateString}</div>`;
    }
    setInterval(updateClock,1000);
    updateClock();

    zoomRange.addEventListener('input', e => {
      mallaContainer.style.transform = `scale(${e.target.value/100})`;
    });
    mallaContainer.style.transform = `scale(${zoomRange.value/100})`;

    async function cascadeRemove(code){
      aprobados.delete(code);
      const dependentRamos = document.querySelectorAll(`.ramo[data-req*="${code}"]`);
      for (const r of dependentRamos) {
        if (aprobados.has(r.dataset.code)) {
          await cascadeRemove(r.dataset.code);
        }
      }
    }

    const CREDITOS_TOTALES_POR_AREA = {
        espiritual: 14, general: 22, profesional: 166, especialidad: 50, practica: 46
    };

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

      for (const area in creditosPorArea) {
          const span = document.getElementById(`creditos-${area}`);
          const total = CREDITOS_TOTALES_POR_AREA[area];
          const current = creditosPorArea[area];
          if (span) span.textContent = `${current}/${total}`;
          
          const row = document.querySelector(`#legend tr[data-area="${area}"] td`);
          if (row) {
            row.classList.toggle('area-completed', current >= total);
          }
      }

      document.querySelectorAll('.year').forEach(y=>{
        const yearNumber = y.dataset.year;
        const semestersInYear = y.querySelectorAll('.semestre:not(.empty)');
        const allSemestersComplete = [...semestersInYear].every(s => parseFloat(s.querySelector('.progress-fill').style.width) === 100);
        
        if (allSemestersComplete && semestersInYear.length > 0) {
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

    function showRamoInfoModal(ramoElement) {
        const code = ramoElement.dataset.code;
        ramoInfoModal.querySelector('#modal-ramo-nombre').textContent = ramoElement.textContent.trim();
        ramoInfoModal.querySelector('#modal-ramo-code').textContent = code;
        ramoInfoModal.querySelector('#modal-ramo-area').textContent = ramoElement.dataset.area;
        ramoInfoModal.querySelector('#modal-ramo-creditos').textContent = ramoElement.dataset.creditos || 'N/A';
        const reqRamo = document.querySelector(`.ramo[data-code="${ramoElement.dataset.req}"]`);
        ramoInfoModal.querySelector('#modal-ramo-req').textContent = reqRamo ? reqRamo.textContent.trim() : (ramoElement.dataset.req || 'Ninguno');
        ramoInfoModal.querySelector('#modal-ramo-desc').textContent = ramoElement.dataset.desc || 'No hay descripción.';
        
        ramoInfoModal.querySelector('#modal-btn-aprobado').style.display = aprobados.has(code) ? 'none' : 'inline-block';
        ramoInfoModal.querySelector('#modal-btn-desmarcar').style.display = aprobados.has(code) ? 'inline-block' : 'none';
        
        ramoInfoModal.dataset.currentCode = code;
        showModal('ramo-info-modal');
    }

    ramos.forEach(r => r.onclick = () => showRamoInfoModal(r));

    ramoInfoModal.querySelector('#modal-btn-aprobado').addEventListener('click', async () => {
        const code = ramoInfoModal.dataset.currentCode;
        const ramoElement = document.querySelector(`.ramo[data-code="${code}"]`);
        const dependencies = ramoElement.dataset.req ? ramoElement.dataset.req.split(',') : [];

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

    ramoInfoModal.querySelector('#modal-btn-desmarcar').addEventListener('click', async () => {
        const code = ramoInfoModal.dataset.currentCode;
        await cascadeRemove(code);
        await saveUserData();
        updateUI();
        closeModal('ramo-info-modal');
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
      showCustomConfirm('¿Estás seguro de que quieres reiniciar todo el progreso? Esto no se puede deshacer.', async () => {
        aprobados.clear();
        completedSem.clear();
        completedYear.clear();
        await saveUserData();
        updateUI();
        closeModal('custom-confirm-modal');
      });
    });

    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if(modal) modal.classList.add('show');
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if(modal) modal.classList.remove('show');
    }

    function showCustomAlert(message, title = "Información") {
        const alertModal = document.getElementById('tr-nico-message-modal');
        alertModal.querySelector('.modal-title').textContent = title;
        alertModal.querySelector('p').textContent = message;
        showModal('tr-nico-message-modal');
    }

    function showAutoCloseAlert(message, duration = 3000) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'auto-close-alert';
        alertDiv.textContent = message;
        document.body.appendChild(alertDiv);
        setTimeout(() => {
            alertDiv.classList.add('hide');
            setTimeout(() => alertDiv.remove(), 500);
        }, duration);
    }

    function showCustomConfirm(message, onConfirm) {
        const confirmModal = document.getElementById('custom-confirm-modal');
        confirmModal.querySelector('#confirm-message').textContent = message;
        const yesBtn = confirmModal.querySelector('#confirm-reset-yes');
        const newYesBtn = yesBtn.cloneNode(true);
        yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
        newYesBtn.addEventListener('click', onConfirm);
        showModal('custom-confirm-modal');
    }

    function showSemesterCompleteModal(message) {
        const modal = document.getElementById('semester-complete-modal');
        if (modal) {
            modal.querySelector('#semester-complete-message').textContent = message;
            showModal('semester-complete-modal');
        }
    }

    document.querySelectorAll('.modal-backdrop').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.id);
        });
        modal.querySelectorAll('.modal-close-button, .btn-close, #confirm-reset-no, #tr-nico-modal-close-btn, #semester-complete-modal-close-btn').forEach(btn => {
            btn.addEventListener('click', () => closeModal(modal.id));
        });
    });

    document.getElementById('tr-nico-info-btn').addEventListener('click', () => {
        showCustomAlert("Regalito del tr._nico para mis compañeros químicos farmacéuticos.", "Mensaje Especial");
    });

    const normalize = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

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
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data && Array.isArray(data.aprobados)) {
                    aprobados = new Set(data.aprobados);
                    completedSem = new Set(data.completedSem || []);
                    completedYear = new Set(data.completedYear || []);
                    setTheme(data.theme || 'light');
                    await saveUserData();
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
        event.target.value = '';
    });

    const imageToBase64 = async (url) => {
        try {
            const response = await fetch(`${url}?v=${new Date().getTime()}`, { cache: 'no-store' });
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error("Error al convertir imagen a Base64:", error);
            return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        }
    };

    document.getElementById('export-pdf-btn').addEventListener('click', async () => {
        const exportButton = document.getElementById('export-pdf-btn');
        showCustomAlert("Generando PDF, por favor espera...", "Exportando");
        exportButton.disabled = true;

        const exportContainer = document.createElement('div');
        exportContainer.id = 'pdf-export-container';
        Object.assign(exportContainer.style, {
            position: 'absolute', left: '-9999px', top: '0px', padding: '40px',
            backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg'),
            color: getComputedStyle(document.body).getPropertyValue('--text'),
            width: '1900px'
        });
        document.body.appendChild(exportContainer);

        const headerElement = document.createElement('div');
        const logoImg = document.querySelector('#header-left img');
        const logoBase64 = await imageToBase64(logoImg.src);
        const titleText = document.querySelector('#header-title a').textContent.trim();
        const universityText = document.querySelector('#university-name').textContent.trim();
        headerElement.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 2px solid var(--accent);">
                <img src="${logoBase64}" style="height: 60px;">
                <div style="text-align: center;">
                    <h1 style="font-family: 'Playfair Display', serif; font-size: 2.2em; color: var(--accent); margin: 0;">${titleText}</h1>
                    <h2 style="font-family: 'Inter', sans-serif; font-size: 1.1em; font-weight: 600; margin: 5px 0 0 0;">${universityText}</h2>
                </div>
                <div style="width: 60px;"></div>
            </div>`;
        exportContainer.appendChild(headerElement);

        const mallaCloned = document.getElementById('malla').cloneNode(true);
        mallaCloned.id = 'malla-cloned-for-export';
        mallaCloned.classList.add('malla-for-export');
        exportContainer.appendChild(mallaCloned);

        const infoContainer = document.createElement('div');
        infoContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: flex-start; margin-top: 20px;';
        const legendCloned = document.getElementById('legend').cloneNode(true);
        legendCloned.style.margin = '0';
        infoContainer.appendChild(legendCloned);

        const creditosText = document.getElementById('creditos-info').textContent.trim();
        const themeText = `Tema: ${themeSelector.options[themeSelector.selectedIndex].text}`;
        const dateText = `Fecha: ${new Date().toLocaleString('es-CL')}`;
        const footerInfo = document.createElement('div');
        footerInfo.style.textAlign = 'right';
        footerInfo.innerHTML = `<p style="font-size: 1em; font-weight: 600; margin: 0 0 5px 0;">${creditosText}</p><p style="font-size: 1em; margin: 0 0 5px 0;">${themeText}</p><p style="font-size: 1em; margin: 0;">${dateText}</p>`;
        infoContainer.appendChild(footerInfo);
        exportContainer.appendChild(infoContainer);

        const { jsPDF } = window.jspdf;
        try {
            const canvas = await html2canvas(exportContainer, { scale: 2, useCORS: true, allowTaint: true, logging: false });
            const imgData = canvas.toDataURL('image/png');
            const doc = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
            doc.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            doc.save('Malla-UNACH-Progreso.pdf');
            showAutoCloseAlert('¡Tu malla se ha descargado con éxito!');
        } catch (error) {
            console.error("Error al exportar a PDF:", error);
            showCustomAlert("Hubo un error al generar el PDF.");
        } finally {
            exportContainer.remove();
            exportButton.disabled = false;
            closeModal('tr-nico-message-modal');
        }
    });

    const calendarGrid = document.getElementById('calendar-grid');
    const currentMonthYear = document.getElementById('current-month-year');
    let currentCalendarDate = new Date();

    function renderCalendar() {
        if (!calendarGrid || !currentMonthYear) return;
        const month = currentCalendarDate.getMonth();
        const year = currentCalendarDate.getFullYear();
        currentMonthYear.textContent = `${new Date(year, month).toLocaleString('es-ES', { month: 'long', year: 'numeric' })}`;
        calendarGrid.innerHTML = '';
        const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
        dayNames.forEach(day => {
            const dayNameEl = document.createElement('div');
            dayNameEl.className = 'day-name';
            dayNameEl.textContent = day;
            calendarGrid.appendChild(dayNameEl);
        });
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startOffset = (firstDay === 0) ? 6 : firstDay - 1;
        for (let i = 0; i < startOffset; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.classList.add('calendar-day', 'empty');
            calendarGrid.appendChild(emptyDay);
        }
        const today = new Date();
        for (let i = 1; i <= daysInMonth; i++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            dayEl.textContent = i;
            if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                dayEl.classList.add('current-day');
            }
            calendarGrid.appendChild(dayEl);
        }
    }

    document.getElementById('prev-month')?.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });
    document.getElementById('next-month')?.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });

    renderCalendar();
    updateClock();
}

// --- Ejecutar la Aplicación ---
main().catch(error => {
    console.error("Ocurrió un error inesperado al iniciar la aplicación:", error);
});
