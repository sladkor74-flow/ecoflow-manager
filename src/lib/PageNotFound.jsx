import { Link, useLocation } from 'react-router-dom';

// La pagina di un indirizzo che non esiste (15/10/2026): in italiano, e senza
// la nota del modello iniziale che rimandava a chi ha costruito il sito. Nel
// gestionale non si nomina la piattaforma, nemmeno all'amministratore.
export default function PageNotFound() {
    const location = useLocation();
    const indirizzo = location.pathname;

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="space-y-2">
                    <h1 className="text-7xl font-light text-slate-300">404</h1>
                    <div className="h-0.5 w-16 bg-slate-200 mx-auto"></div>
                </div>
                <div className="space-y-3">
                    <h2 className="text-2xl font-medium text-slate-800">Pagina non trovata</h2>
                    <p className="text-slate-600 leading-relaxed">
                        L'indirizzo <span className="font-medium text-slate-700 break-all">{indirizzo}</span> non corrisponde a nessuna pagina del gestionale.
                        Forse il collegamento è vecchio o è stato scritto a mano: le pagine sono tutte nel menu a sinistra.
                    </p>
                </div>
                <div className="pt-4">
                    <Link
                        to="/"
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
                    >
                        Torna alla dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
