'use strict';
import moment from 'moment';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${moment().format(
      'MMMM Do'
    )}`;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevation = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// const run = new Running([39, -12], 5.2, 24, 178);
// const cycling = new Cycling([39, -12], 28, 98, 583);
// console.log(run, cycling);

// ========================================
// APPLICATION ARCHITECTURE

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const containerOptionsBtns = document.querySelector('.options__btn');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const btnSort = document.querySelector('.sort__btn');
const btnClearAll = document.querySelector('.clr__all__btn');
const msgContainer = document.querySelector('.confirmation__container');
const yesBtn = document.querySelector('.yes__btn');
const noBtn = document.querySelector('.no__btn');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = [];
  #sortOptions = ['distanceASC', 'distanceDESC', 'durationASC', 'durationDESC', 'default'];
  #count = 0;
  #latitude;
  #longitude;

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);

    containerWorkouts.addEventListener('click', (e) =>
      e.target.closest('.ph') ? this._deleteWorkout(e) : this._moveToPopup(e)
    );

    btnSort.addEventListener('click', this._sortWorkouts.bind(this));

    btnClearAll.addEventListener('click', this._showMsg.bind(this));

    yesBtn.addEventListener('click', () => {
      this._clearWorkoutList();
      msgContainer.classList.add('msg__hidden');
    });

    noBtn.addEventListener('click', () => msgContainer.classList.add('msg__hidden'));
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), function () {
        alert('Could not get your position');
      });
    }
  }

  _loadMap(position) {
    this.#latitude = position.coords.latitude;
    this.#longitude = position.coords.longitude;

    const coords = [this.#latitude, this.#longitude];
    // console.log(coords);

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);
    // console.log(this.#map);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling click on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach((work) => {
      this._renderWorkoutMarker(work);
    });

    this._renderCurrentPositionMarker(coords);
  }

  _geoCode([lat, lng]) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(lat, lng);
        const res = await fetch(`https://geocode.xyz/${lat},${lng}?geoit=json`);
        if (!res.ok) throw new Error('Problem getting location data');

        const dataGeo = await res.json();
        console.log(dataGeo);
        const info = [dataGeo.country, dataGeo.city];
        console.log(info);

        resolve(info);
      } catch (error) {
        console.error(error);
        reject(error);
      }
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    e.preventDefault();

    const validInputs = (...inputs) => inputs.every((inp) => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every((inp) => inp > 0);

    // Get data form form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (!validInputs(distance, duration, cadence) || !allPositive(distance, duration, cadence))
        return alert('Inputs have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      // Check if data is valid
      if (!validInputs(distance, duration, elevation) || !allPositive(distance, duration))
        return alert('Inputs have to be positive numbers!');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);
    // console.log(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage(this.#workouts);

    this._geoCode([this.#latitude, this.#longitude]);
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords);
    this.#markers.push(marker);

    marker
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(`${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`)
      .openPopup();
  }

  _renderCurrentPositionMarker(position) {
    L.marker(position)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `current-popup`,
        })
      )
      .setPopupContent(`📍 Current Location`)
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <h2 class="workout__title">${workout.description}</h2>
      <div class="workout__modify">
        <i class="ph ph-x"></i>
        <ul class="options-list">
          <li>Usuń</li>
        </ul>
      </div>

      <div class="workout__details">
        <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'}</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>
      `;

    if (workout.type === 'running')
      html += `
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.pace.toFixed(1)}</span>
        <span class="workout__unit">min/km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">🦶🏼</span>
        <span class="workout__value">${workout.cadence}</span>
        <span class="workout__unit">spm</span>
      </div>
      </li>
      `;

    if (workout.type === 'cycling')
      html += `
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.speed.toFixed(1)}</span>
        <span class="workout__unit">km/h</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⛰</span>
        <span class="workout__value">${workout.elevation}</span>
        <span class="workout__unit">m</span>
      </div>
      </li>
      `;

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    if (!this.#map) return;

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find((work) => work.id === workoutEl.dataset.id);
    //  console.log(workout);

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _sortWorkouts() {
    const currentValue = this.#sortOptions[this.#count];

    let workoutsArr = this.#workouts.map((w) => w);

    if (currentValue === 'distanceASC') {
      workoutsArr.sort((a, b) => a.distance - b.distance);
    }
    if (currentValue === 'distanceDESC') {
      workoutsArr.sort((a, b) => b.distance - a.distance);
    }
    if (currentValue === 'durationASC') {
      workoutsArr.sort((a, b) => a.duration - b.duration);
    }
    if (currentValue === 'durationDESC') {
      workoutsArr.sort((a, b) => b.duration - a.duration);
    }
    if (currentValue === 'default') {
      workoutsArr = this.#workouts;
    }

    containerWorkouts.querySelectorAll('.workout').forEach((workout) => workout.remove());

    workoutsArr.forEach((workout) => {
      this._renderWorkout(workout);
    });

    this.#count = (this.#count + 1) % this.#sortOptions.length;
  }

  _deleteWorkout(e) {
    const deleteEl = e.target.closest('.workout');
    const deleteBtn = e.target.closest('.workout__modify');

    if (!deleteBtn) return;

    this.#workouts.forEach((workout, i) => {
      if (deleteEl.dataset.id === workout.id) {
        this.#workouts = this.#workouts.filter((el) => el.id !== deleteEl.dataset.id);
        this.#markers[i].remove();
        this.#markers.splice(i, 1);

        this._setLocalStorage(this.#workouts);
        deleteEl.remove();
      }
    });
  }

  _clearWorkoutList() {
    // Remove form localStorage
    localStorage.removeItem('workouts');
    this.#workouts = [];
    this.#markers.forEach((marker) => this.#map.removeLayer(marker));
    this.#markers = [];
    containerWorkouts.innerHTML = '';
  }

  _showMsg() {
    if (this.#workouts.length === 0) return;
    msgContainer.classList.remove('msg__hidden');
  }

  _setLocalStorage(workout) {
    localStorage.setItem('workouts', JSON.stringify(workout));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    data.forEach((work) => this._renderWorkout(work));
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
