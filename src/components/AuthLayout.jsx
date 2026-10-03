import React from "react";
import { PRODOTTO, SOTTOTITOLO, COMMESSA } from '@/lib/prodotto';

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* IL NOME SULLA PORTA. Le schermate di accesso sono le prime che si
            vedono, e l'unica cosa scritta era il titolo della pagina («Welcome
            back»): il prodotto non si nominava. Il nome sta sopra il titolo,
            perche' chi arriva deve sapere dove sta entrando prima di sapere che
            cosa gli si chiede. */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <Icon className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
          </div>
          <p className="font-heading font-bold text-xl tracking-tight text-foreground">{PRODOTTO}</p>
          <p className="text-xs text-muted-foreground mb-4">{SOTTOTITOLO} · {COMMESSA}</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}
