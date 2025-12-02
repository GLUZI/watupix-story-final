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
    // Création du conteneur de la carte avec une hauteur fixée
    CONTENT_AREA.innerHTML = `
        <div id="mapid" style="height: 50vh; width: 100vw; margin-bottom: 10px;"></div>
        <p>${step.clueText}</p>
    `;
    
    if (!navigator.geolocation) {
        APP_DESCRIPTION.textContent = 'La géolocalisation n\'est pas supportée par votre navigateur.';
        return;
    }

    // Coordonnées de la cible (Cathédrale de Strasbourg)
    const targetLat = step.targetLocation.lat;
    const targetLon = step.targetLocation.lon;
    const rayon = step.targetLocation.rayon || 20;
    
    let userMarker = null;
    let mapInitialized = false;

    // Fonction pour initialiser la carte, centrée sur une position donnée
    const initializeMap = (centerLat, centerLon, isFallback = false) => {
        if (mapInitialized) return;
        mapInitialized = true;
        
        // Afficher le titre de la carte maintenant qu'elle est prête
        APP_TITLE.textContent = step.titre || currentStoryData.title;
        
        // Initialisation de la carte, centrée sur la position fournie (utilisateur ou cible)
        mymap = L.map('mapid').setView([centerLat, centerLon], 13);
        
        // CORRECTION MAJEURE: Forcer l'initialisation de la carte après que le DOM soit prêt
        mymap.on('load', function() {
            mymap.invalidateSize();
            console.log('Map size invalidated after loading.');
        });
        
        // Si l'initialisation vient du GPS, cela fonctionne souvent mieux
        if (!isFallback) {
             mymap.on('locationfound', function() {
                 mymap.invalidateSize();
             });
        }

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(mymap);

        // Marqueur de la Cible
        L.marker([targetLat, targetLon]).addTo(mymap)
            .bindPopup(step.targetName || 'Cible').openPopup();

        // Cercle de Tolérance
        L.circle([targetLat, targetLon], {
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.2,
            radius: rayon
        }).addTo(mymap);
        
        if (isFallback) {
             APP_DESCRIPTION.textContent = "Géolocalisation en cours... Carte centrée sur la cible en attendant.";
        }
    };
    
    // --- CONTOURNNEMENT (FALLBACK) ---
    // Si la position n'est pas obtenue après 5 secondes, afficher la carte centrée sur la cible
    const gpsTimeout = setTimeout(() => {
        if (!mapInitialized) {
            console.log("GPS timeout, using target as center.");
            // Centrer sur la cible (Strasbourg)
            initializeMap(targetLat, targetLon, true); 
        }
    }, 5000); // 5 secondes

    // ************* LOGIQUE DE VÉRIFICATION GPS *************
    watchId = navigator.geolocation.watchPosition((position) => {
        // Le GPS a réussi, annuler le timeout
        clearTimeout(gpsTimeout);
        
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        const targetLocation = step.targetLocation;

        if (!mapInitialized) {
            // Initialiser la carte centrée sur l'utilisateur
            initializeMap(userLat, userLon, false); 
        }

        const distance = calculateDistance(userLat, userLon, targetLocation.lat, targetLocation.lon);

        // Afficher la distance dans la description
        APP_DESCRIPTION.textContent = `Distance restante jusqu'à la cible : ${Math.round(distance)} mètres.`;

        // Mettre à jour le marqueur utilisateur sur la carte
        if (userMarker) {
            userMarker.setLatLng([userLat, userLon]);
        } else if (mymap) {
            // Créer un marqueur pour l'utilisateur
            userMarker = L.marker([userLat, userLon]).addTo(mymap).bindPopup("Vous êtes ici").openPopup();
        }
        
        // S'assurer que la carte suit l'utilisateur
        if (mymap) mymap.panTo([userLat, userLon]);

    }, (error) => {
        // En cas d'erreur
        console.error("Erreur GPS:", error);
        clearTimeout(gpsTimeout);
        if (!mapInitialized) {
            // Afficher la carte centrée sur la cible en cas d'erreur immédiate
            initializeMap(targetLat, targetLon, true);
        }
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
