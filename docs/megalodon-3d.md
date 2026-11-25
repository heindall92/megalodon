# Megalodón 3D: anatomía, fuentes y decisiones

El megalodón (*Otodus megalodon*) solo se conoce por dientes y vértebras, así que su aspecto se reconstruye por analogía con el tiburón blanco (*Carcharodon carcharias*). El modelo sigue esa convención: cuerpo lamniforme, boca y mordisco del tiburón blanco a escala de un animal de unos 16 m.

## Boca

Comparada con fotografías de tiburones blancos con la boca abierta, una boca abierta no es una ranura: son dos **arcos en herradura** cubiertos por una **banda gruesa de encía rosada**, con los dientes repartidos de forma regular a lo largo de cada arco.

| Rasgo | Cómo está en el modelo | Fuente |
|---|---|---|
| Mandíbula superior no soldada al cráneo (suspensión hiostílica); al morder protruye hacia delante y hacia abajo y deja la encía al descubierto | `uProt` desplaza encía, dientes y paladar superiores; el frente protruye más que las comisuras (`protW`) | Tricas (1985); White Shark Ocean, «How a Great White Shark's Jaw Actually Works» (2026) |
| Unos 24 dientes expuestos por mandíbula | 13 superiores y 12 inferiores por lado | Marine Dynamics / Shark Watch SA, «How many teeth does a white shark have?» |
| Dientes superiores anchos y triangulares, aserrados en ambos bordes; inferiores más estrechos y puntiagudos | `tooth()` con bordes convexos y aserrado fino; los inferiores con cuello estrecho | White Shark Ocean (2026); ScienceDirect, «Carcharodon» (el diente intermedio superior es distinto) |
| Filas de reemplazo detrás de las funcionales | Una fila por mandíbula, tumbada hacia el interior | Natural History Museum, «What can shark teeth tell us?» |
| El tiburón blanco rota el ojo hacia atrás al morder (no tiene membrana nictitante) | `uEye` aclara el ojo durante el mordisco | Descripción divulgativa extendida; dato secundario |

## Secuencia del mordisco

Tricas, T. C. (1985). *Feeding ethology of the white shark, Carcharodon carcharias*. Memoirs of the Southern California Academy of Sciences, 9, 81-91.

| Acto (Tricas 1985) | Tiempo medio real | En el modelo (cámara lenta ×4,5) |
|---|---|---|
| Elevación del hocico + descenso de la mandíbula inferior (simultáneos) | apertura máxima a 0,167 s | 0 → 0,75 s, pausa breve en la apertura máxima |
| Protrusión del palatocuadrado | máximo a 0,307 s | 1,3 → 2,0 s |
| Elevación de la mandíbula inferior (cierre, a la vez que la protrusión) | bocado completo en 0,443 s | 1,3 → 2,4 s |
| Bajada del hocico y retracción del palatocuadrado | 0,16-0,41 s | 2,6 → 4,4 s |

Tras el cierre, la cabeza sacude de lado a lado, como describe White Shark Ocean para el corte con los dientes aserrados.

## Nado

Nado carangiforme: una onda lateral de longitud ≈ 1,1 L cuya amplitud crece hacia la cola (envolvente de Lighthill), con la cabeza casi quieta. La misma deformación está en el vertex shader y en JavaScript, para que las cotas del plano técnico sigan al animal.

## Lo que no se usó

Las fotografías se consultaron solo como referencia visual. No hay ninguna imagen, modelo ni textura de terceros en el repositorio: todo se genera con código.
