export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Caricamento DS Academy"
      className="loading-shell"
    >
      <div className="skeleton h-12 w-64" />
      <div className="skeleton h-52" />
      <div className="skeleton h-80" />
    </main>
  );
}
