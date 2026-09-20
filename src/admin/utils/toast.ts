type ToastType = 'success' | 'error' | 'info';

export function notify(message: string, type: ToastType = 'info') {
  if (typeof window === 'undefined') return;

  let container = document.getElementById('admin-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'admin-toast-container';
    container.className = 'fixed bottom-6 right-6 z-[100] flex flex-col gap-2.5 w-80 sm:w-96 pointer-events-none';
    document.body.appendChild(container);
  }

  const toastEl = document.createElement('div');
  const bg = type === 'success' ? 'bg-moss/10 border-moss text-moss' : type === 'error' ? 'bg-coral/10 border-coral text-coral' : 'bg-grape/10 border-grape text-grape';
  
  toastEl.className = `flex items-center justify-between gap-3 rounded-2xl border-2 ${bg} bg-cream p-4 shadow-lift pointer-events-auto transition-all duration-300 transform translate-y-2 opacity-0 font-semibold text-xs text-ink`;
  toastEl.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="font-bold uppercase tracking-wider text-[10px] ${bg}">${type}</span>
      <span>${message}</span>
    </div>
    <button class="text-inksoft hover:text-ink cursor-pointer ml-2 text-xs font-bold">✕</button>
  `;

  const dismissBtn = toastEl.querySelector('button');
  if (dismissBtn) {
    dismissBtn.onclick = () => {
      toastEl.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toastEl.remove(), 300);
    };
  }

  container.appendChild(toastEl);

  requestAnimationFrame(() => {
    toastEl.classList.remove('opacity-0', 'translate-y-2');
  });

  setTimeout(() => {
    if (toastEl.parentNode) {
      toastEl.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toastEl.remove(), 300);
    }
  }, 4000);
}

export function useToast() {
  return { notify };
}