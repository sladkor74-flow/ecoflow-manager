import React from 'react';
import Assegnati from '@/pages/Assegnati';

export default function AssegnatiAci() {
  return (
    <Assegnati
      entity="AssegnatoAci"
      title="Assegnati ACI — Backlog Autodemolizioni"
      description={`Ordini in stato "assegnato" di classe PFU Autodemolizione, derivati automaticamente dal caricamento delle Primarie.`}
    />
  );
}