export type DataMutationDetail = {
  reason?: string;
};

const EVENT_NAME = 'nimbus:data-mutated';

export function emitDataMutated(detail?: DataMutationDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<DataMutationDetail>(EVENT_NAME, { detail }));
}

export function subscribeToDataMutations(
  listener: (detail: DataMutationDetail) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = ((event: Event) => {
    const custom = event as CustomEvent<DataMutationDetail>;
    listener(custom.detail ?? {});
  }) as EventListener;

  window.addEventListener(EVENT_NAME, handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
  };
}


