// --- VARIABLES GLOBALES ET ÉLÉMENTS DU DOM ---
const APP_CONTAINER = document.getElementById('app-container');
const CONTENT_AREA = document.getElementById('content-area');
const MAIN_BUTTON = document.getElementById('main-button');
const APP_TITLE = document.getElementById('app-title');
const APP_DESCRIPTION = document.getElementById('app-description');

let currentStoryData = null; // Contient tout le JSON
let currentStepIndex = 0; // Pointeur dans le tableau 'steps'
let watchId = null; // ID de la surveillance GPS

// --- DÉMARRAGE DE L'APPLICATION ---
document.addEventListener('DOMContentLoaded', () => {
    loadStory('stories/bretzel_dor.json');
});

// 1. CHARGEMENT DE L'HISTOIRE PAR JSON
async function loadStory(path) {
    try {
        const response = await fetch(path);
        currentStoryData = await response.json();
        console.log('Histoire chargée :', currentStoryData.title);
        renderStep(currentStoryData.steps[0]); // Commence par la première étape (index 0)
    } catch (error) {
        APP_TITLE.textContent = "Erreur de chargement";
        APP_DESCRIPTION.textContent = "Le fichier JSON est manquant ou mal formaté.";
        console.error("Erreur de chargement JSON:", error);
    }
}

// 2. RENDU D'UNE ÉTAPE
function renderStep(step) {
    // Nettoyer la zone de contenu et le bouton
    CONTENT_AREA.innerHTML = '';
    MAIN_BUTTON.style.display = 'none';

    // Mise à jour du titre et de la description de l'étape
    APP_TITLE.textContent = step.title || currentStoryData.title;
    APP_DESCRIPTION.textContent = step.description || step.clueText || '';

    switch (step.type) {
        case 'INTRO_SCREEN':
            // Afficher le bouton pour commencer
            MAIN_BUTTON.textContent = step.actionButtonText;
            MAIN_BUTTON.style.display = 'block';
            MAIN_BUTTON.onclick = () => {
                const nextStep = currentStoryData.steps.find(s => s.stepId === step.stepId + 1);
                currentStepIndex++;
                renderStep(nextStep);
            };
            break;

        case 'RADAR_GPS':
            // Afficher le radar et démarrer la surveillance GPS
            CONTENT_AREA.innerHTML = `
                <div id="radar-circle" class="cold">
                    <div class="pulse"></div>
                    <span style="font-size: 2rem;">📍</span>
                </div>
                <p id="distance-display">Recherche du signal...</p>
                <button onclick="simulateArrival()" style="font-size:0.7rem; background:#333; color:#666; border:none; margin-top:50px; ${step.simulation_button ? '' : 'display:none;'}">(Mode Développeur : Simuler Arrivée)</button>
            `;
            startGPS(step.targetLocation, step.nextStepId);
            break;

        case 'CODE_INPUT':
            // Afficher le champ de saisie de code
            CONTENT_AREA.innerHTML = `
                <input type="text" id="secret-input" placeholder="CODE">
                <p id="error-msg" style="color:red; display:none;">Mauvais code !</p>
            `;
            MAIN_BUTTON.textContent = "VALIDER LE CODE";
            MAIN_BUTTON.style.display = 'block';
            MAIN_BUTTON.onclick = () => checkCode(step.solution, step.nextStepId);
            break;

        case 'REWARD_SCREEN':
            // Afficher le ticket de récompense
            CONTENT_AREA.innerHTML = `
                <div class="ticket">
                    <h2 style="margin:0; color:#d4a017;">${step.rewardTitle}</h2>
                    <h1 style="margin:10px 0; font-size:3rem;">🥨</h1>
                    <strong>${step.rewardDetails}</strong>
                </div>
            `;
            MAIN_BUTTON.textContent = step.actionButtonText;
            MAIN_BUTTON.style.display = 'block';
            MAIN_BUTTON.onclick = () => console.log("Aventure terminée!"); // Fin de l'aventure
            break;
    }
}


// --- LOGIQUE DU JEU (GPS et VÉRIFICATION) ---

// GESTION DU GPS
function startGPS(target, nextStepId) {
    if (watchId) navigator.geolocation.clearWatch(watchId); // Arrête l'ancienne surveillance
    
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            (position) => updatePosition(position, target, nextStepId),
            (error) => console.error("Erreur GPS:", error.message),
            { enableHighAccuracy: true }
        );
    } else {
        alert("GPS non supporté sur ce téléphone.");
    }
}

function updatePosition(position, target, nextStepId) {
    const userLat = position.coords.latitude;
    const userLon = position.coords.longitude;
    
    // Calcul distance
    const dist = getDistanceFromLatLonInKm(userLat, userLon, target.lat, target.lon) * 1000; // en mètres
    
    document.getElementById('distance-display').innerText = `Distance cible : ${Math.round(dist)} mètres`;
    updateRadar(dist);

    // Si la distance est inférieure au rayon de la cible
    if (dist < target.radius) {
        if (watchId) navigator.geolocation.clearWatch(watchId); // Arrêter le GPS pour économiser la batterie
        const nextStep = currentStoryData.steps.find(s => s.stepId === nextStepId);
        currentStepIndex = nextStepId - 1; // Ajustement de l'index
        renderStep(nextStep);
    }
}

function updateRadar(dist) {
    const radar = document.getElementById('radar-circle');
    radar.className = ''; // Réinitialise les classes
    
    if (dist > 500) {
        radar.classList.add('cold');
        if(navigator.vibrate) navigator.vibrate(1);
    } else if (dist > 50) {
        radar.classList.add('warm');
        if(navigator.vibrate) navigator.vibrate(100);
    } else {
        radar.classList.add('hot');
        if(navigator.vibrate) navigator.vibrate(200);
    }
}

// VÉRIFICATION DU CODE
function checkCode(solution, nextStepId) {
    const input = document.getElementById('secret-input').value.toUpperCase();
    const errorMsg = document.getElementById('error-msg');
    
    if (input === solution) {
        errorMsg.style.display = 'none';
        const nextStep = currentStoryData.steps.find(s => s.stepId === nextStepId);
        currentStepIndex = nextStepId - 1;
        renderStep(nextStep);
    } else {
        errorMsg.style.display = 'block';
        errorMsg.textContent = "Mauvais code ! Réessayez.";
        if(navigator.vibrate) navigator.vibrate([100, 50, 100]); 
    }
}

// FONCTION MATHÉMATIQUE DE DISTANCE (Haversine)
function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
    var R = 6371; 
    var dLat = deg2rad(lat2-lat1);  
    var dLon = deg2rad(lon2-lon1); 
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c; 
    return d;
}
function deg2rad(deg) { return deg * (Math.PI/180); }

// SIMULATION DÉVELOPPEUR (Pour le bouton)
function simulateArrival() {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    const radarStep = currentStoryData.steps.find(s => s.type === 'RADAR_GPS');
    if (radarStep) {
        const nextStep = currentStoryData.steps.find(s => s.stepId === radarStep.nextStepId);
        currentStepIndex = radarStep.nextStepId - 1;
        renderStep(nextStep);
    }
}