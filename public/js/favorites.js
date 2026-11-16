// Followed teams, kept in this browser only ("sport|team name").
const KEY = 'scoreweb.favorites.v1';

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return new Set(Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

let favorites = read();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...favorites]));
  } catch {
    // Private browsing or storage disabled: favorites last until the page is closed
  }
}

export const favKey = (sport, name) => `${sport}|${name}`;
export const isFav = (sport, name) => favorites.has(favKey(sport, name));

export function toggleFav(key) {
  if (favorites.has(key)) favorites.delete(key);
  else favorites.add(key);
  save();
}

/** Team names followed for `sport`, in the order they were added. */
export function favNames(sport) {
  const prefix = `${sport}|`;
  return [...favorites].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
}

// Another tab changed the list
window.addEventListener('storage', (e) => {
  if (e.key === KEY) favorites = read();
});
