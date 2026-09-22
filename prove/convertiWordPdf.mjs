// Prova dello script che converte in PDF i Word della cartella del mese
// (src/lib/convertiWordPdf.js). Qui si controlla come sono fatti i due file:
// che facciano il loro mestiere lo si e' visto lanciandoli con Word. npm run prove
import { fileConversione, NOME_CMD, NOME_PS1 } from '../src/lib/convertiWordPdf.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const file = fileConversione('SETTEMBRE');
const testo = (nome) => new TextDecoder().decode(file.find(f => f.percorso.endsWith(nome)).bytes);
const byte = (nome) => file.find(f => f.percorso.endsWith(nome)).bytes;

console.log('I DUE FILE');
verifica('stanno nella cartella del mese', file.length === 2 && file.every(f => f.percorso.startsWith('SETTEMBRE/')), JSON.stringify(file.map(f => f.percorso)));
verifica('il .cmd si avvia col doppio clic e chiama il .ps1 accanto', testo(NOME_CMD).includes(`"%~dp0${NOME_PS1}"`) && /ExecutionPolicy Bypass/.test(testo(NOME_CMD)));
verifica('il .cmd non ha accenti: il prompt li mostrerebbe sbagliati', !/[^\x00-\x7f]/.test(testo(NOME_CMD)));
verifica('il .ps1 comincia col segno dei byte, per gli accenti', byte(NOME_PS1)[0] === 0xef && byte(NOME_PS1)[1] === 0xbb && byte(NOME_PS1)[2] === 0xbf);
verifica('i file finiscono le righe come Windows', testo(NOME_CMD).includes('\r\n') && testo(NOME_PS1).includes('\r\n'));

console.log('\nCHE COSA FA LO SCRIPT');
const ps1 = testo(NOME_PS1);
verifica('guarda anche nelle sottocartelle', /Get-ChildItem[^\n]*-Recurse/.test(ps1));
verifica('prende solo i Word, non sé stesso', ps1.includes("$_.Extension -match '^\\.docx?$'"), ps1.split('\n').find(r => /Extension -match/.test(r)));
verifica('salta i file temporanei di Word', /~\$\*/.test(ps1));
verifica('usa il Word installato e l\'esportazione in PDF', /New-Object -ComObject Word\.Application/.test(ps1) && /ExportAsFixedFormat/.test(ps1) && /wdExportFormatPDF = 17/.test(ps1));
verifica('apre i documenti in sola lettura', /Documents\.Open\(\$f\.FullName, \$false, \$true\)/.test(ps1));
verifica('non rifa\' un PDF gia\' aggiornato, a meno di -Rifai', /Test-Path -LiteralPath \$pdf/.test(ps1) && /-not \$Rifai/.test(ps1) && /\[switch\]\$Rifai/.test(ps1));
verifica('se Word non c\'e\' lo dice invece di rompersi', /non trovo Word/.test(ps1));
verifica('chiude Word anche quando qualcosa va storto', /finally \{[\s\S]*\$word\.Quit\(\)/.test(ps1));
verifica('conta e dice quanti ne ha fatti', /Convertiti: \$fatti/.test(ps1));
verifica('aspetta un tasto, cosi\' col doppio clic si legge l\'esito', /ReadKey/.test(ps1));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
