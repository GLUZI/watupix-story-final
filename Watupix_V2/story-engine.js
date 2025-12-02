// --- VARIABLES GLOBALES ET ÉLÉMENTS DU DOM ---
const APP_CONTAINER = document.getElementById('app-container');
const CONTENT_AREA = document.getElementById('content-area');
const MAIN_BUTTON = document.getElementById('main-button');
const APP_TITLE = document.getElementById('app-title');
const APP_DESCRIPTION = document.getElementById('app-description');

let currentStoryData = null; // Contient tout le JSON
let watchId = null; // ID du moniteur de la géolocalisation

// --- DÉMARRAGE DE L'APPLICATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialisation après le chargement du DOM (le script d'onboarding appelle loadStory)
});

// --- CHARGEMENT DE L'HISTOIRE PAR JSON ---
function loadStory(path) {
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
                APP_DESCRIPTION.textContent = 'Le fichier JSON est manquant ou mal formaté.';
                console.error('Erreur de chargement JSON', error);
            });
    } catch (error) {
        console.error("Erreur de fetch dans loadStory:", error);
    }
}

// --- RENDU D'UNE ÉTAPE ---
function renderStep(step) {
    // Nettoyer la zone de contenu et le bouton
    CONTENT_AREA.innerHTML = '';
    MAIN_BUTTON.style.display = 'none';
    
    // Affichage des informations générales
    APP_TITLE.textContent = step.titre;
    APP_DESCRIPTION.textContent = step.description || '';

    // Logique basée sur le type d'étape
    switch (step.taper) {
        case 'ECRAN_D_INTRODUCTION':
        case 'ECRAN_DE_RECOMPENSE':
            renderSimpleScreen(step);
            break;

        case 'RADAR_GPS':
            // Remplacer l'ancien Radar moche par la carte
            renderMap(step);
            break;

        case 'SAISIE_DE_CODE':
            renderCodeInput(step);
            break;
            
        default:
            APP_DESCRIPTION.textContent = `Type d'étape inconnu : ${step.taper}`;
    }
}

// --- AFFICHAGE DE LA CARTE Leaflet (Anciennement Radar) ---
function renderMap(step) {
    CONTENT_AREA.innerHTML = '<div id="mapid" style="height: 100vh; width: 100vw;"></div>';
    
    // Assurez-vous d'avoir l'autorisation de géolocalisation
    if (!navigator.geolocation) {
        CONTENT_AREA.innerHTML = '<p>La géolocalisation n\'est pas supportée par votre navigateur.</p>';
        return;
    }

    // Centrer la carte sur la cible pour l'instant
    const targetLat = step.targetLocation.lat;
    const targetLon = step.targetLocation.lon;
    const rayon = step.targetLocation.rayon || 20;

    // Initialisation de la carte (coordonnées de Strasbourg pour un aperçu si besoin, sinon on utilise la cible)
    var mymap = L.map('mapid').setView([targetLat, targetLon], 16); // Zoom 16 pour être précis

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(mymap);

    // Marqueur de la Cible
    L.marker([targetLat, targetLon]).addTo(mymap)
        .bindPopup(step.targetName || 'Votre cible').openPopup();

    // Cercle de Tolérance (la zone à atteindre)
    L.circle([targetLat, targetLon], {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.2,
        radius: rayon
    }).addTo(mymap);

    // ************* LOGIQUE DE VÉRIFICATION GPS *************
    // Initialisation du moniteur de position (similaire à l'ancien Radar)
    let userMarker = null;

    watchId = navigator.geolocation.watchPosition((position) => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        const targetLocation = step.targetLocation;

        // Calcul de la distance (Fonction très simplifiée pour l'exemple)
        const distance = calculateDistance(userLat, userLon, targetLocation.lat, targetLocation.lon);

        APP_DESCRIPTION.textContent = `Distance cible : ${Math.round(distance)} mètres.`;

        // Mettre à jour le marqueur utilisateur sur la carte
        if (userMarker) {
            userMarker.setLatLng([userLat, userLon]);
        } else {
            userMarker = L.marker([userLat, userLon], { icon: L.divIcon({ className: 'user-marker' }) }).addTo(mymap);
        }
        
        // S'assurer que la carte se recentre sur l'utilisateur s'il bouge
        mymap.panTo([userLat, userLon]);


        // VÉRIFICATION DE L'ARRIVÉE
        if (distance <= rayon) {
            alert(`Félicitations ! Vous êtes arrivé à ${step.targetName || 'votre cible'} !`);
            navigator.geolocation.clearWatch(watchId); // Arrêter le GPS
            // Passer à l'étape suivante (exemple : SAISIE_DE_CODE)
            const nextStep = currentStoryData.steps.find(s => s.stepId === step.nextStepId);
            if (nextStep) {
                renderStep(nextStep);
            }
        }

    }, (error) => {
        console.error("Erreur GPS:", error);
        APP_DESCRIPTION.textContent = "Erreur de géolocalisation. Assurez-vous que le GPS est activé.";
    }, { enableHighAccuracy: true });

    // Bouton de simulation si 'bouton_simulation' est à 'vrai' dans le JSON (pour les tests)
    if (step.bouton_simulation === 'vrai') {
        MAIN_BUTTON.textContent = "Mode Développeur : Simuler Arrivée";
        MAIN_BUTTON.style.display = 'block';
        MAIN_BUTTON.onclick = () => {
             // Simuler l'arrivée et passer à l'étape suivante
             const nextStep = currentStoryData.steps.find(s => s.stepId === step.nextStepId);
             if (nextStep) {
                navigator.geolocation.clearWatch(watchId);
                renderStep(nextStep);
             }
        };
    }
}

// --- FONCTIONS SIMPLES ---
function renderSimpleScreen(step) {
    if (step.image) {
        CONTENT_AREA.innerHTML = `<img src="${step.image}" alt="${step.titre}" style="width:100%; max-width:400px; margin: 10px auto;">`;
    }
    MAIN_BUTTON.textContent = step.actionButtonText || "Continuer";
    MAIN_BUTTON.onclick = () => {
        const nextStep = currentStoryData.steps.find(s => s.stepId === step.nextStepId);
        if (nextStep) {
            renderStep(nextStep);
        }
    };
    MAIN_BUTTON.style.display = 'block';
}

function renderCodeInput(step) {
    CONTENT_AREA.innerHTML = `
        <p>${step.clueText}</p>
        <input type="text" id="codeInput" placeholder="Entrez le code" style="padding: 10px; margin: 10px 0; display: block; width: 80%; max-width: 300px;">
        <p id="codeFeedback" style="color: red;"></p>
    `;
    MAIN_BUTTON.textContent = "Valider le code";
    MAIN_BUTTON.onclick = () => {
        const input = document.getElementById('codeInput').value.toUpperCase();
        if (input === (step.solution || '').toUpperCase()) {
            document.getElementById('codeFeedback').textContent = 'Code correct !';
            const nextStep = currentStoryData.steps.find(s => s.stepId === step.nextStepId);
            if (nextStep) {
                renderStep(nextStep);
            }
        } else {
            document.getElementById('codeFeedback').textContent = 'Code incorrect, réessayez.';
        }
    };
    MAIN_BUTTON.style.display = 'block';
}


// --- UTILITAIRE GPS (Calcul de distance) ---
// Formule de la Haversine simplifiée pour une petite distance (en mètres)
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
