// index.js - Script pour traiter stops.txt et créer cff_stations.json
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Configuration
const INPUT_FILE = 'stops.txt';
const OUTPUT_FILE = 'cff_stations.json';

console.log('🚂 Début du traitement des stations CFF...');

// Fonction principale
async function processGTFSStops() {
    const stations = [];
    let totalRows = 0;
    let processedStations = 0;

    return new Promise((resolve, reject) => {
        // Vérifier si le fichier existe
        if (!fs.existsSync(INPUT_FILE)) {
            console.error(`❌ Erreur: Le fichier ${INPUT_FILE} n'existe pas dans ce dossier`);
            console.log('📁 Contenu du dossier actuel:');
            fs.readdirSync('.').forEach(file => console.log(`   - ${file}`));
            reject(new Error('Fichier stops.txt manquant'));
            return;
        }

        console.log(`📖 Lecture du fichier ${INPUT_FILE}...`);

        fs.createReadStream(INPUT_FILE)
            .pipe(csv({
                // Options pour gérer différents formats CSV
                separator: ',',
                quote: '"',
                escape: '"',
            }))
            .on('data', (row) => {
                totalRows++;

                // Debug: afficher les premières lignes pour comprendre la structure
                if (totalRows <= 3) {
                    console.log(`📋 Ligne ${totalRows}:`, Object.keys(row));
                }

                // Filtrer et traiter les stations
                const locationTypeStr = row.location_type || '0';
                const locationTypeNum = parseInt(locationTypeStr);

                // Conditions pour inclure une station:
                // 1. location_type = 1 (station principale)
                // 2. OU pas de parent_station (arrêt principal)
                // 3. ET nom non vide
                const isMainStation = locationTypeNum === 1;
                const isMainStop = !row.parent_station || row.parent_station === '';
                const hasValidName = row.stop_name && row.stop_name.trim() !== '';

                if ((isMainStation || isMainStop) && hasValidName) {
                    const station = {
                        id: row.stop_id || `station_${processedStations}`,
                        name: row.stop_name.trim(),
                        lat: parseFloat(row.stop_lat) || 0,
                        lon: parseFloat(row.stop_lon) || 0,
                        type: locationTypeNum === 1 ? 'station' : 'stop',
                        // Informations additionnelles optionnelles
                        ...(row.stop_code && { code: row.stop_code }),
                        ...(row.platform_code && { platform: row.platform_code }),
                    };

                    // Validation des coordonnées (Suisse approximativement)
                    const isInSwitzerland = (
                        station.lat >= 45.8 && station.lat <= 47.9 &&
                        station.lon >= 5.8 && station.lon <= 10.6
                    );

                    if (isInSwitzerland || (station.lat === 0 && station.lon === 0)) {
                        stations.push(station);
                        processedStations++;

                        // Afficher le progrès
                        if (processedStations % 100 === 0) {
                            console.log(`📍 ${processedStations} stations traitées...`);
                        }
                    }
                }
            })
            .on('end', () => {
                console.log(`\n✅ Traitement terminé!`);
                console.log(`📊 Statistiques:`);
                console.log(`   - Lignes totales lues: ${totalRows}`);
                console.log(`   - Stations extraites: ${stations.length}`);

                // Trier les stations par nom pour un meilleur autocomplete
                stations.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

                // Sauvegarder le fichier JSON
                try {
                    const jsonData = JSON.stringify(stations, null, 2);
                    fs.writeFileSync(OUTPUT_FILE, jsonData, 'utf8');

                    const fileSizeKB = Math.round(fs.statSync(OUTPUT_FILE).size / 1024);

                    console.log(`💾 Fichier sauvegardé: ${OUTPUT_FILE}`);
                    console.log(`📏 Taille du fichier: ${fileSizeKB} KB`);

                    // Afficher quelques exemples
                    console.log(`\n🎯 Exemples de stations extraites:`);
                    stations.slice(0, 5).forEach((station, index) => {
                        console.log(`   ${index + 1}. ${station.name} (${station.id}) - ${station.type}`);
                    });

                    resolve(stations);
                } catch (error) {
                    console.error('❌ Erreur lors de la sauvegarde:', error);
                    reject(error);
                }
            })
            .on('error', (error) => {
                console.error('❌ Erreur lors de la lecture du CSV:', error);
                reject(error);
            });
    });
}

// Fonction pour analyser la structure du fichier CSV
function analyzeCSVStructure() {
    console.log('\n🔍 Analyse de la structure du fichier...');

    let headerAnalyzed = false;

    fs.createReadStream(INPUT_FILE)
        .pipe(csv())
        .on('data', (row) => {
            if (!headerAnalyzed) {
                console.log('📋 Colonnes détectées:');
                Object.keys(row).forEach((key, index) => {
                    console.log(`   ${index + 1}. ${key}`);
                });

                console.log('\n📝 Exemple de données:');
                console.log(JSON.stringify(row, null, 2));

                headerAnalyzed = true;
            }
        })
        .on('end', () => {
            console.log('\n🚀 Lancement du traitement principal...\n');
            processGTFSStops()
                .then(() => {
                    console.log('\n🎉 Traitement réussi! Tu peux maintenant utiliser cff_stations.json dans ton app.');
                })
                .catch((error) => {
                    console.error('\n💥 Erreur lors du traitement:', error.message);
                    process.exit(1);
                });
        })
        .on('error', (error) => {
            console.error('❌ Erreur d\'analyse:', error);
            // Essayer le traitement direct si l'analyse échoue
            processGTFSStops();
        });
}

// Fonction utilitaire pour créer un échantillon de test
function createSampleOutput() {
    processGTFSStops()
        .then((stations) => {
            // Créer un échantillon plus petit pour les tests
            const sample = stations.slice(0, 50);
            fs.writeFileSync('cff_stations_sample.json', JSON.stringify(sample, null, 2));
            console.log('📋 Échantillon créé: cff_stations_sample.json (50 premières stations)');
        });
}

// Point d'entrée principal
if (require.main === module) {
    console.log('🔧 Vérification des dépendances...');

    // Vérifier si csv-parser est installé
    try {
        require('csv-parser');
        console.log('✅ csv-parser trouvé');
    } catch (error) {
        console.log('❌ csv-parser manquant');
        console.log('📦 Exécute: npm install csv-parser');
        process.exit(1);
    }

    // Arguments de ligne de commande
    const args = process.argv.slice(2);

    if (args.includes('--analyze')) {
        analyzeCSVStructure();
    } else if (args.includes('--sample')) {
        createSampleOutput();
    } else {
        // Traitement normal
        processGTFSStops()
            .then(() => {
                console.log('\n🎉 Terminé! Fichier cff_stations.json créé avec succès.');
                console.log('\n📱 Prochaines étapes:');
                console.log('   1. Copie cff_stations.json dans ton projet React Native');
                console.log('   2. Place-le dans src/assets/ ou similaire');
                console.log('   3. Importe-le: import stations from "./assets/cff_stations.json"');
            })
            .catch((error) => {
                console.error('\n💥 Erreur:', error.message);
                process.exit(1);
            });
    }
}
