// Monaco Made Easy: routes, lifts and places.
// IMPORTANT: this is preview data gathered from published sources. Every route and lift
// must be walked and checked on the ground (and photographed) before launch.
// "checked: false" shows a "Being checked" note in the app.

window.MME = {
  // Districts, with rough height above sea level in metres (approximate, for the height chart).
  places: {
    station:   { name: "Monaco Monte-Carlo station", short: "Station", area: "Monaco", height: 35, x: 38, label: "r", lat: 43.7393, lng: 7.4199 },
    casino:    { name: "Casino Square", short: "Casino", area: "Monte-Carlo", height: 40, x: 66, label: "b", lat: 43.7397, lng: 7.4277 },
    port:      { name: "Port Hercule", short: "Port", area: "La Condamine", height: 2, x: 44, label: "b", lat: 43.7347, lng: 7.4219 },
    palace:    { name: "Prince's Palace", short: "Palace", area: "Monaco-Ville (the Rock)", height: 60, x: 21, label: "a", lat: 43.7313, lng: 7.4199 },
    museum:    { name: "Oceanographic Museum", short: "Museum", area: "Monaco-Ville (the Rock)", height: 55, x: 29, label: "r", lat: 43.7307, lng: 7.4253 },
    larvotto:  { name: "Larvotto Beach", short: "Larvotto", area: "Larvotto", height: 2, x: 91, label: "b", lat: 43.7449, lng: 7.4344 },
    exotic:    { name: "Exotic Garden", short: "Exotic Garden", area: "Moneghetti", height: 100, x: 5, label: "r", lat: 43.7311, lng: 7.4108 },
    fontvieille:{ name: "Fontvieille", short: "Fontvieille", area: "Fontvieille", height: 4, x: 13, label: "r", lat: 43.7286, lng: 7.4162 },
    beausoleil:{ name: "Beausoleil, Place de la Libération", short: "Beausoleil", area: "Beausoleil (France)", height: 80, x: 62, label: "r", lat: 43.7428, lng: 7.4228 }
  },

  routes: [
    {
      id: "station-casino",
      from: "station", to: "casino",
      title: "Station to Casino Square",
      minutes: 15, stepFree: true, climbSaved: 25,
      summary: "Leave the station by the upper exit, using the station lifts, then a gentle walk to the Casino.",
      checked: false,
      steps: [
        { type: "walk", text: "Inside the station, follow the signs for the Boulevard Princesse Charlotte exit. The underground gallery is long but flat.", h: 35 },
        { type: "lift", text: "Take the station lifts up to Boulevard Princesse Charlotte.", h: 60 },
        { type: "walk", text: "Follow the signs for the Casino. It's mostly a gentle downhill walk through the Boulevard des Moulins shopping streets.", h: 40 },
        { type: "arrive", text: "Arrive at Casino Square. The tourist office here has accessible toilets.", h: 40 }
      ],
      tip: "The station lifts have been out of service in the past. If they are, ask staff for the step-free way out.",
      maps: "Place du Casino, Monaco"
    },
    {
      id: "port-casino",
      from: "port", to: "casino",
      title: "Port Hercule to Casino Square",
      minutes: 10, stepFree: true, climbSaved: 40,
      summary: "Public lifts next to the Rainier III Auditorium lift you straight from the harbour to the Casino terraces.",
      checked: false,
      steps: [
        { type: "walk", text: "Walk along the harbour front towards the Rainier III Auditorium, at the Monte-Carlo end of the port. It's flat all the way.", h: 2 },
        { type: "lift", text: "Take the public lifts by the Auditorium up to the Casino terraces.", h: 40 },
        { type: "walk", text: "Cross the terraces, with sea views, to Casino Square. It's level.", h: 40 },
        { type: "arrive", text: "Arrive at Casino Square.", h: 40 }
      ],
      maps: "Auditorium Rainier III, Monaco"
    },
    {
      id: "port-palace",
      from: "port", to: "palace",
      title: "Port Hercule to the Prince's Palace",
      minutes: 20, stepFree: true, climbSaved: 55,
      summary: "Skip the steep Rampe Major. Lifts from the Parking des Pêcheurs bring you up onto the Rock by the Oceanographic Museum.",
      checked: false,
      steps: [
        { type: "walk", text: "Walk along the harbour towards the Rock, to the Parking des Pêcheurs at its foot.", h: 2 },
        { type: "lift", text: "Take the public lifts in the Parking des Pêcheurs up onto the Rock.", h: 55 },
        { type: "walk", text: "Come out near the Oceanographic Museum. Walk through the old town's level lanes towards the Palace. Some lanes are cobbled.", h: 60 },
        { type: "arrive", text: "Arrive at Palace Square. The Changing of the Guard is at 11:55 each day.", h: 60 }
      ],
      tip: "No walking at all: buses 1 and 2 go up to Monaco-Ville. A single ticket costs about €1.50, but check before you travel.",
      maps: "Parking des Pêcheurs, Monaco"
    },
    {
      id: "casino-larvotto",
      from: "casino", to: "larvotto",
      title: "Casino Square to Larvotto Beach",
      minutes: 15, stepFree: true, climbSaved: 38,
      summary: "Escalators and lifts take you down from the Monte-Carlo shopping streets to the beach promenade. They're even more useful on the way back up.",
      checked: false,
      steps: [
        { type: "walk", text: "From Casino Square, walk up to Place des Moulins.", h: 45 },
        { type: "escalator", text: "Follow the blue lift signs. Escalators and lifts take you down towards Avenue Princesse Grace.", h: 5 },
        { type: "walk", text: "Cross to the seafront promenade. It's flat all the way along.", h: 2 },
        { type: "arrive", text: "Arrive at Larvotto Beach. It has adapted showers, toilets and changing rooms.", h: 2 }
      ],
      maps: "Plage du Larvotto, Monaco"
    },
    {
      id: "exotic-fontvieille",
      from: "exotic", to: "fontvieille",
      title: "Exotic Garden to Fontvieille",
      minutes: 15, stepFree: true, climbSaved: 95,
      summary: "Monaco's biggest drop, from the clifftop gardens to the harbour at Fontvieille, almost all by lift.",
      checked: false,
      steps: [
        { type: "walk", text: "From the Exotic Garden entrance, follow the blue public lift signs.", h: 100 },
        { type: "lift", text: "Take the public lift down to Avenue Hector Otto.", h: 60 },
        { type: "lift", text: "Keep following the lift signs down towards Fontvieille.", h: 10 },
        { type: "arrive", text: "Arrive in Fontvieille, near the rose garden and the shopping centre.", h: 4 }
      ],
      maps: "Fontvieille, Monaco"
    },
    {
      id: "beausoleil-casino",
      from: "beausoleil", to: "casino",
      title: "Beausoleil to Casino Square",
      minutes: 12, stepFree: false, climbSaved: 40,
      summary: "Staying in Beausoleil? It's an easy walk downhill into Monaco. Coming back up, use the public lifts.",
      checked: false,
      steps: [
        { type: "walk", text: "From Place de la Libération, head downhill towards Boulevard de France. That's the border with Monaco, and there's no checkpoint.", h: 80 },
        { type: "walk", text: "Continue down into Monte-Carlo, following signs for the Casino. Some streets are steep, and there may be a few steps.", h: 45 },
        { type: "arrive", text: "Arrive at Casino Square.", h: 40 }
      ],
      back: "Going back up: Beausoleil's public lifts, including the Rex lift on Square Kraemer and the lift at the Libération car park, save the climb. In 2020 they were reported to run from 5am to 9pm.",
      sponsor: true,
      maps: "Place du Casino, Monaco"
    }
  ],

  // Map positions are APPROXIMATE until pinned on the ground (approx: true draws a dashed marker).
  lifts: [
    { id: "station", name: "Station lifts", where: "Monaco Monte-Carlo station", links: "Station platforms ↔ Boulevard Princesse Charlotte", area: "Monaco", type: "lift", lat: 43.7400, lng: 7.4207, approx: true },
    { id: "auditorium", name: "Rainier III Auditorium lifts", where: "Boulevard Louis II", links: "Port Hercule ↔ Casino terraces", area: "Monaco", type: "lift", lat: 43.7376, lng: 7.4256, approx: true },
    { id: "pecheurs", name: "Parking des Pêcheurs lifts", where: "Foot of the Rock", links: "Harbour ↔ Monaco-Ville, by the Oceanographic Museum", area: "Monaco", type: "lift", lat: 43.7318, lng: 7.4243, approx: true },
    { id: "condamine", name: "Condamine Market lifts", where: "Place d'Armes", links: "La Condamine market ↔ upper streets", area: "Monaco", type: "lift", lat: 43.7336, lng: 7.4187, approx: true },
    { id: "moulins", name: "Place des Moulins escalators", where: "Monte-Carlo", links: "Shopping streets ↔ Larvotto", area: "Monaco", type: "escalator", lat: 43.7428, lng: 7.4298, approx: true },
    { id: "exotic", name: "Exotic Garden lift", where: "Boulevard du Jardin Exotique", links: "Exotic Garden ↔ Avenue Hector Otto", area: "Monaco", type: "lift", lat: 43.7317, lng: 7.4119, approx: true },
    { id: "rex", name: "Rex lift", where: "Square Kraemer", links: "Lower Beausoleil ↔ upper Beausoleil", area: "Beausoleil", type: "lift", lat: 43.7420, lng: 7.4245, approx: true },
    { id: "liberation", name: "Libération lift", where: "Indigo car park, Place de la Libération", links: "Car park levels ↔ Place de la Libération", area: "Beausoleil", type: "lift", lat: 43.7430, lng: 7.4231, approx: true },
    { id: "josephine", name: "Palais Joséphine lift", where: "Palais Joséphine", links: "Street levels in central Beausoleil", area: "Beausoleil", type: "lift", lat: 43.7436, lng: 7.4214, approx: true },
    { id: "elisa", name: "Jardins d'Elisa lifts (2)", where: "Jardins d'Elisa", links: "Street levels in Beausoleil", area: "Beausoleil", type: "lift", lat: 43.7443, lng: 7.4252, approx: true },
    { id: "noix", name: "Chemin de la Noix lift", where: "Chemin de la Noix", links: "Vallon de la Noix area", area: "Beausoleil", type: "lift", lat: 43.7452, lng: 7.4196, approx: true }
  ]
};
