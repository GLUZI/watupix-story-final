// --- VARIABLES GLOBALES ET ÉLÉMENTS DU DOM ---
const APP_CONTAINER = document.getElementById('app-container');
const CONTENT_AREA = document.getElementById('content-area');
const MAIN_BUTTON = document.getElementById('main-button');
const APP_TITLE = document.getElementById('app-title');
const APP_DESCRIPTION = document.getElementById('app-description');

let currentStoryData = null; // Contient tout le JSON
let watchId = null; // ID du moniteur de la géolocalisation
let mymap = null; // Variable globale pour la carte Leaflet

// --- DÉMARRAGE DE L'APPLICATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Le script d'onboarding appelle loadStory
});

// --- CHARGEMENT DE L'HISTOIRE PAR JSON ---
function loadStory(path) {
    // S'assurer qu'on arrête l'ancien GPS si on recharge
    if (watchId) navigator.geolocation.clearWatch(watchId);
    
    try {
        fetch(path)
            .then(response => response.json())
            .then(data => {
                currentStoryData = data;
                console.log('Histoire chargée.', currentStoryData.title);
                // Commence par la première étape (Index 0)
                renderStep(currentStoryData.steps[0]);
            })
            .catch(error => {
                APP_TITLE.textContent = 'Erreur de chargement';
                APP_DESCRIPTION.textContent = 'Le fichier JSON est manquant ou mal formaté. (Vérifiez le nom du fichier !)';
                console.error('Erreur de chargement JSON', error);
            });
    } catch (error) {
        console.error("Erreur de fetch dans loadStory:", error);
    }
}

// --- RENDU D'UNE ÉTAPE ---
function renderStep(step) {
    // Nettoyer la zone de contenu
    CONTENT_AREA.innerHTML = '';
    MAIN_BUTTON.style.display = 'none';

    // Affichage des informations générales
    APP_TITLE.textContent = step.titre || currentStoryData.title;
    APP_DESCRIPTION.textContent = step.description || '';
    
    // Cacher la carte si elle existe
    if (mymap) { mymap.remove(); mymap = null; }

    // Logique basée sur le type d'étape
    switch (step.taper) {
        case 'ECRAN_D_INTRODUCTION':
            renderSimpleScreen(step);
            break;

        case 'RADAR_GPS':
            renderMap(step);
            break;
            
        default:
            APP_DESCRIPTION.textContent = `Type d'étape inconnu : ${step.taper}`;
    }
}

// --- AFFICHAGE DE LA CARTE Leaflet (RADAR_GPS) ---
function renderMap(step) {
    // Création du conteneur de la carte avec une hauteur fixée (50% de la fenêtre)
    CONTENT_AREA.innerHTML = `
        <div id="mapid" style="height: 50vh; width: 100vw; margin-bottom: 10px;"></div>
        <p>${step.clueText}</p>
    `;
    
    // Vérification de la géolocalisation
    if (!navigator.geolocation) {
        APP_DESCRIPTION.textContent = 'La géolocalisation n\'est pas supportée par votre navigateur.';
        return;
    }

    // Coordonnées de la cible
    const targetLat = step.targetLocation.lat;
    const targetLon = step.targetLocation.lon;
    const rayon = step.targetLocation.rayon || 20;

    // Initialisation de la carte, centrée sur la cible
    mymap = L.map('mapid').setView([targetLat, targetLon], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(mymap);

    // Marqueur de la Cible
    L.marker([targetLat, targetLon]).addTo(mymap)
        .bindPopup(step.targetName || 'Cible').openPopup();

    // Cercle de Tolérance (zone à atteindre)
    L.circle([targetLat, targetLon], {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.2,
        radius: rayon
    }).addTo(mymap);

    // ************* LOGIQUE DE VÉRIFICATION GPS *************
    let userMarker = null;

    watchId = navigator.geolocation.watchPosition((position) => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        const targetLocation = step.targetLocation;

        const distance = calculateDistance(userLat, userLon, targetLocation.lat, targetLocation.lon);

        // Afficher la distance dans la description (au-dessus de la carte)
        APP_DESCRIPTION.textContent = `Distance restante jusqu'à la cible : ${Math.round(distance)} mètres.`;

        // Mettre à jour le marqueur utilisateur sur la carte
        if (userMarker) {
            userMarker.setLatLng([userLat, userLon]);
        } else {
            // Créer un marqueur pour l'utilisateur
            userMarker = L.marker([userLat, userLon]).addTo(mymap).bindPopup("Vous êtes ici").openPopup();
        }
        
        // S'assurer que la carte suit l'utilisateur
        mymap.panTo([userLat, userLon]);

    }, (error) => {
        console.error("Erreur GPS:", error);
        APP_DESCRIPTION.textContent = "Erreur de géolocalisation. Assurez-vous que le GPS est activé et autorisé pour ce site.";
    }, { enableHighAccuracy: true });
}

// --- FONCTIONS SIMPLES ---
function renderSimpleScreen(step) {
    MAIN_BUTTON.textContent = step.actionButtonText || "Continuer";
    MAIN_BUTTON.onclick = () => {
        const nextStep = currentStoryData.steps.find(s => s.stepId === step.nextStepId);
        if (nextStep) {
            renderStep(nextStep);
        }
    };
    MAIN_BUTTON.style.display = 'block';
}

// --- UTILITAIRE GPS (Calcul de distance) ---
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Rayon de la Terre en mètres
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
