/* Clean Force: services, prices and areas. This file is the price truth for the
   website, the booking flow and the first load of the admin. Prices are MVR and
   are placeholders until the client confirms them. */
window.CF_DATA = {
  phone: '7800016',
  phoneIntl: '9607800016',
  bank: { name: 'Bank of Maldives', account: '7730000123456', holder: 'Clean Force Pvt Ltd' },

  areas: [
    { id: 'male', name: 'Malé', img: 'assets/img/area-male.jpg' },
    { id: 'hulhumale', name: 'Hulhumalé', img: 'assets/img/area-hulhumale.jpg' },
    { id: 'hulhumale2', name: 'Hulhumalé Phase 2', img: 'assets/img/area-phase2.jpg' },
    { id: 'vilimale', name: 'Vilimalé', img: 'assets/img/area-vilimale.jpg' }
  ],

  services: [
    { id: 'home', name: 'Home cleaning', short: 'Regular clean, every room', unit: 'Flat size', img: 'assets/img/living-after.jpg',
      options: [ { id: '1br', name: '1 bedroom', price: 450 }, { id: '2br', name: '2 bedrooms', price: 650 }, { id: '3br', name: '3 bedrooms', price: 850 } ] },
    { id: 'deep', name: 'Deep cleaning', short: 'Top to bottom, inside and out', unit: 'Flat size', img: 'assets/img/kitchen-after.jpg',
      options: [ { id: '1br', name: '1 bedroom', price: 700 }, { id: '2br', name: '2 bedrooms', price: 1100 }, { id: '3br', name: '3 bedrooms', price: 1400 } ] },
    { id: 'move', name: 'Move in / move out', short: 'Empty flat, handover ready', unit: 'Flat size', img: 'assets/img/bedroom-after.jpg',
      options: [ { id: '1br', name: '1 bedroom', price: 900 }, { id: '2br', name: '2 bedrooms', price: 1300 }, { id: '3br', name: '3 bedrooms', price: 1700 } ] },
    { id: 'sofa', name: 'Sofa cleaning', short: 'Shampoo and stain removal', unit: 'Seats', img: 'assets/img/sofa-after.jpg',
      options: [ { id: '3s', name: '3 seats', price: 450 }, { id: '5s', name: '5 seats', price: 700 }, { id: '7s', name: '7 seats', price: 950 } ] },
    { id: 'bath', name: 'Bathroom and kitchen', short: 'Scale, grease and mould', unit: 'Rooms', img: 'assets/img/bathroom-after.jpg',
      options: [ { id: 'b1', name: '1 bathroom', price: 300 }, { id: 'bk', name: 'Kitchen', price: 400 }, { id: 'b2k', name: '2 bathrooms + kitchen', price: 900 } ] },
    { id: 'monthly', name: 'Monthly plan', short: '4 visits a month', unit: 'Flat size', img: 'assets/img/crew-mop.jpg', monthly: true,
      options: [ { id: '1br', name: '1 bedroom', price: 1600 }, { id: '2br', name: '2 bedrooms', price: 2300 }, { id: '3br', name: '3 bedrooms', price: 3000 } ] },
    { id: 'office', name: 'Office cleaning', short: 'Desks, floors, pantry', unit: 'Office size', img: 'assets/img/office.jpg',
      options: [ { id: 'o1', name: 'Up to 2 rooms', price: 600 }, { id: 'o3', name: '3 to 4 rooms', price: 1100 }, { id: 'o5', name: '5 rooms or more', price: 1600 } ] }
  ],

  addons: [
    { id: 'fridge', name: 'Inside fridge', price: 100 },
    { id: 'windows', name: 'Windows, inside', price: 150 },
    { id: 'balcony', name: 'Balcony', price: 100 },
    { id: 'ac', name: 'AC filter wash', price: 150 }
  ],

  slots: ['08:00', '10:30', '13:30', '16:00'],

  teams: [
    { id: 'A', name: 'Team A', lead: 'Hassan' },
    { id: 'B', name: 'Team B', lead: 'Rifaz' },
    { id: 'C', name: 'Team C', lead: 'Shiyam' },
    { id: 'D', name: 'Team D', lead: 'Nashid' }
  ],

  statuses: [
    { id: 'booked', name: 'Booked' },
    { id: 'confirmed', name: 'Confirmed' },
    { id: 'onway', name: 'Team on the way' },
    { id: 'cleaning', name: 'Cleaning' },
    { id: 'done', name: 'Done' },
    { id: 'cancelled', name: 'Cancelled' }
  ]
};
