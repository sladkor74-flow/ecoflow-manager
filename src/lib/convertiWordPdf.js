// Lo script che converte in PDF i Word della cartella del mese (22/09/2026).
//
// Le dichiarazioni nascono in Word e vanno consegnate anche in PDF. Il browser
// non puo' avviare programmi del computer, ma sui computer dove si lavora Word
// c'e': nella cartella del mese si mette allora un piccolo script che usa quel
// Word e converte tutti i .docx, anche quelli nelle sottocartelle.
//
// Due file, perche' un .ps1 con un doppio clic si aprirebbe nell'editor:
// il .cmd si avvia con un doppio clic e chiama il .ps1 che sta accanto.
// Non si installa niente e non si scarica niente: lavora solo sui file che ha
// intorno, con il Word gia' presente.

export const NOME_CMD = 'Converti i Word in PDF.cmd';
export const NOME_PS1 = 'Converti i Word in PDF.ps1';

// Niente accenti nel .cmd: il prompt dei comandi usa un'altra tabella di
// caratteri e li mostrerebbe sbagliati.
const CMD = `@echo off
rem Converte in PDF tutti i Word di questa cartella e delle sottocartelle.
rem Serve Word installato. Non installa e non scarica niente.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0${NOME_PS1}" -Cartella "%~dp0."
`;

const PS1 = `# Converte in PDF tutti i Word di questa cartella e delle sottocartelle,
# usando il Word installato sul computer. Non installa e non scarica niente.
#
# Si avvia con un doppio clic su "${NOME_CMD}", oppure:
#   powershell -ExecutionPolicy Bypass -File "${NOME_PS1}" [-Cartella <percorso>] [-Rifai]
#
# Un PDF gia' presente e piu' recente del suo Word non si rifa', a meno di -Rifai.
param(
  [string]$Cartella = $PSScriptRoot,
  [switch]$Rifai
)

$ErrorActionPreference = 'Stop'
$wdExportFormatPDF = 17
$radice = (Resolve-Path $Cartella).Path
Write-Host "Cartella: $radice"

$word = $null
$fatti = 0; $saltati = 0; $falliti = 0
$errori = @()
try {
  # L'estensione si guarda a mano: -Include, con una cartella e -Recurse, non
  # filtra niente e si finirebbe per dare in pasto a Word anche questo script.
  $file = Get-ChildItem -LiteralPath $radice -Recurse -File |
    Where-Object { $_.Extension -match '^\\.docx?$' -and $_.Name -notlike '~$*' }
  if (-not $file) {
    Write-Host "Nessun documento Word da convertire."
  } else {
    Write-Host ("Documenti trovati: " + @($file).Count)
    try {
      $word = New-Object -ComObject Word.Application
    } catch {
      throw "Su questo computer non trovo Word: senza, i PDF vanno fatti a mano (apri il documento e Salva come PDF)."
    }
    $word.Visible = $false
    $word.DisplayAlerts = 0
    foreach ($f in $file) {
      $pdf = [System.IO.Path]::ChangeExtension($f.FullName, '.pdf')
      if ((Test-Path -LiteralPath $pdf) -and -not $Rifai -and (Get-Item -LiteralPath $pdf).LastWriteTime -ge $f.LastWriteTime) {
        Write-Host ("  gia' fatto: " + $f.Name)
        $saltati++
        continue
      }
      try {
        $doc = $word.Documents.Open($f.FullName, $false, $true)   # sola lettura
        $doc.ExportAsFixedFormat($pdf, $wdExportFormatPDF)
        $doc.Close($false)
        Write-Host ("  convertito: " + $f.Name)
        $fatti++
      } catch {
        $falliti++
        $errori += ($f.Name + ": " + $_.Exception.Message)
        Write-Host ("  NON riuscito: " + $f.Name) -ForegroundColor Red
      }
    }
  }
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  $falliti++
} finally {
  if ($word) { try { $word.Quit() } catch { } }
}

Write-Host ""
Write-Host ("Convertiti: $fatti - gia' presenti: $saltati - non riusciti: $falliti")
foreach ($e in $errori) { Write-Host ("  " + $e) -ForegroundColor Red }
Write-Host ""
Write-Host "Premi un tasto per chiudere."
try { [void][System.Console]::ReadKey($true) } catch { Start-Sleep -Seconds 5 }
`;

// Il .ps1 con il segno d'ordine dei byte: senza, PowerShell legge gli accenti
// con la tabella sbagliata e i messaggi escono storti.
const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);
const conBom = (testo) => {
  const corpo = new TextEncoder().encode(testo.replace(/\n/g, '\r\n'));
  const fuori = new Uint8Array(BOM.length + corpo.length);
  fuori.set(BOM);
  fuori.set(corpo, BOM.length);
  return fuori;
};
const soloAscii = (testo) => new TextEncoder().encode(testo.replace(/\n/g, '\r\n'));

/**
 * I due file dello script, da mettere nella cartella del mese.
 * @param {string} cartella il percorso dentro lo zip, per esempio "SETTEMBRE"
 * @returns {array} [{ percorso, bytes }]
 */
export function fileConversione(cartella) {
  return [
    { percorso: `${cartella}/${NOME_CMD}`, bytes: soloAscii(CMD) },
    { percorso: `${cartella}/${NOME_PS1}`, bytes: conBom(PS1) },
  ];
}
