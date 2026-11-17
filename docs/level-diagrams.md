# Level Circuit Diagrams

These diagrams show the intended circuit wiring for each level. `[START]`
means the gate is already placed when the level begins. `[FILL]` means the
slot starts empty. Most slots accept any gate with the right number of inputs,
so the player can place a wrong gate; a level is solved when every output light
matches its target. Players can also replace `[START]` gates. Where a label
lists several gates, that slot accepts only those, and the intended gate is in
bold. Some levels have more than one solution. Every output light is a declared target, including intermediate
outputs.

## Level 1: Logic Gate Foundations

Inputs: `in_A=0`, `in_B=1`, `in_C=0`  
Target: `out_Y=1`

```mermaid
flowchart LR
  inA["in_A = 0"] --> not["NOT [START]\nslot_not"]
  not --> and["AND [FILL]\nslot_and"]
  inB["in_B = 1"] --> and
  and --> or["OR [FILL]\nslot_or"]
  inC["in_C = 0"] --> or
  or --> out["out_Y = 1"]
```

## Level 2: Spot the Difference

Inputs: `in_A=1`, `in_B=0`, `in_C=1`, `in_D=1`  
Targets: `out_Z=1`, `out_Y=1`

```mermaid
flowchart LR
  inA["in_A = 1"] --> or["OR [START]\nslot_or"]
  inB["in_B = 0"] --> or
  inC["in_C = 1"] --> not["NOT [START]\nslot_not"]
  or --> xor["XOR [FILL]\nslot_xor"]
  not --> xor
  xor --> xorOut["out_Z = 1"]
  xor --> and["AND [FILL]\nslot_and"]
  inD["in_D = 1"] --> and
  and --> out["out_Y = 1"]
```

## Level 3: The Inverted Combination

Inputs: `in_A=1`, `in_B=1`, `in_C=0`, `in_D=1`, `in_E=1`  
Targets: `out_Z=0`, `out_W=0`, `out_Y=0`

```mermaid
flowchart LR
  inA["in_A = 1"] --> andLeft["AND [START]\nslot_and_left"]
  inB["in_B = 1"] --> andLeft
  inC["in_C = 0"] --> orRight["OR [START]\nslot_or_right"]
  inD["in_D = 1"] --> orRight
  andLeft --> nand["NAND [FILL]\nslot_nand"]
  orRight --> nand
  nand --> nandOut["out_Z = 0"]
  nand --> output["AND [FILL]\nslot_output"]
  inE["in_E = 1"] --> not["NOT [FILL]\nslot_not"]
  not --> notOut["out_W = 0"]
  not --> output
  output --> out["out_Y = 0"]
```

## Level 4: A Quiet Signal

Inputs: `in_A=0`, `in_B=0`, `in_C=1`, `in_D=1`, `in_E=0`, `in_F=1`  
Targets: `out_V=0`, `out_Z=1`, `out_W=1`, `out_Y=1`

```mermaid
flowchart LR
  inA["in_A = 0"] --> orInput["OR [START]\nslot_or"]
  inB["in_B = 0"] --> orInput
  orInput --> orOut["out_V = 0"]
  inC["in_C = 1"] --> not["NOT [START]\nslot_not"]
  orInput --> nor["NOR [FILL]\nslot_nor"]
  not --> nor
  inD["in_D = 1"] --> xor["XOR [START]\nslot_xor"]
  inE["in_E = 0"] --> xor
  nor --> norOut["out_Z = 1"]
  xor --> and["AND [FILL]\nslot_and"]
  inF["in_F = 1"] --> and
  and --> andOut["out_W = 1"]
  nor --> output["OR [FILL]\nslot_output"]
  and --> output
  output --> out["out_Y = 1"]
```

## Level 5: The Complete Circuit

Inputs: `in_A=1`, `in_B=1`, `in_C=1`, `in_D=1`, `in_E=0`, `in_F=0`, `in_G=0`, `in_H=1`  
Targets: `out_V=1`, `out_W=1`, `out_X=1`, `out_Z=1`, `out_Y=1`

```mermaid
flowchart LR
  inA["in_A = 1"] --> andInput["AND [START]\nslot_and"]
  inB["in_B = 1"] --> andInput
  andInput --> andOut["out_V = 1"]
  inC["in_C = 1"] --> orInput["**OR** / XOR / XNOR [START]\nslot_or"]
  inD["in_D = 1"] --> orInput
  orInput --> orOut["out_W = 1"]
  inE["in_E = 0"] --> xor["XOR [START]\nslot_xor"]
  inF["in_F = 0"] --> xor
  inF --> nor["NOR [START]\nslot_nor"]
  inG["in_G = 0"] --> nor
  nor --> norOut["out_X = 1"]
  andInput --> nand["**NAND** / NOR / XNOR [FILL]\nslot_nand"]
  nor --> nand
  inC --> not["NOT [FILL]\nslot_not"]
  xor --> xnor["AND / OR / **XNOR** [FILL]\nslot_xnor"]
  not --> xnor
  xnor --> xnorOut["out_Z = 1"]
  nand --> finalOr["**OR** / NAND / NOR [FILL]\nslot_or_final"]
  xnor --> finalOr
  finalOr --> output["AND [FILL]\nslot_output"]
  inH["in_H = 1"] --> output
  output --> out["out_Y = 1"]
```

## Level 6: Pick the Right Tool

Inputs: `in_A=1`, `in_B=1`, `in_C=0`, `in_D=1`  
Targets: `out_X=0`, `out_Z=1`, `out_Y=0`

```mermaid
flowchart LR
  inA["in_A = 1"] --> left["XOR [FILL]\nslot_left"]
  inB["in_B = 1"] --> left
  left --> leftOut["out_X = 0"]
  inC["in_C = 0"] --> right["OR [FILL]\nslot_right"]
  inD["in_D = 1"] --> right
  right --> rightOut["out_Z = 1"]
  left --> output["NOR [FILL]\nslot_output"]
  right --> output
  output --> out["out_Y = 0"]
```

## Level 7: Tied Together

Inputs: `in_A=1`, `in_B=0`, `in_C=1`  
Targets: `out_Z=0`, `out_W=1`, `out_Y=1`

Both pins of `slot_nand_tied` read the same wire, and so do both pins of
`slot_nor_tied`. This makes NAND and NOR act like NOT.

```mermaid
flowchart LR
  inA["in_A = 1"] --> and["**AND** / OR / XOR [START]\nslot_and"]
  inC["in_C = 1"] --> and
  and -- "pin 1" --> nand["OR / **NAND** / XNOR [FILL]\nslot_nand_tied"]
  and -- "pin 2" --> nand
  nand --> nandOut["out_Z = 0"]
  inB["in_B = 0"] -- "pin 1" --> nor["NOR [FILL]\nslot_nor_tied"]
  inB -- "pin 2" --> nor
  nor --> norOut["out_W = 1"]
  nand --> output["XOR [FILL]\nslot_output"]
  nor --> output
  output --> out["out_Y = 1"]
```

## Level 8: Mirror Match

Inputs: `in_A=0`, `in_B=1`, `in_C=1`, `in_D=0`, `in_E=1`  
Targets: `out_Z=1`, `out_W=1`, `out_Y=1`

```mermaid
flowchart LR
  inA["in_A = 0"] --> xorAB["XOR [START]\nslot_xor_ab"]
  inB["in_B = 1"] --> xorAB
  inC["in_C = 1"] --> xorCD["XOR [START]\nslot_xor_cd"]
  inD["in_D = 0"] --> xorCD
  xorAB --> compare["AND / NOR / **XNOR** [FILL]\nslot_compare"]
  xorCD --> compare
  compare --> compareOut["out_Z = 1"]
  inE["in_E = 1"] --> not["NOT [FILL]\nslot_not"]
  compare --> gate["AND / **NAND** / NOR [FILL]\nslot_gate"]
  not --> gate
  gate --> gateOut["out_W = 1"]
  gate --> output["AND / **OR** / NAND [FILL]\nslot_output"]
  inA --> output
  output --> out["out_Y = 1"]
```

## Level 9: Shared Resources

Inputs: `in_A=1`, `in_B=0`, `in_C=1`, `in_D=1`, `in_E=1`, `in_F=0`  
Targets: `out_U=1`, `out_V=1`, `out_X=0`, `out_W=1`, `out_Y=1`

The palette holds one each of AND, OR, XOR, NOR, XNOR, and NAND, and the
solution uses every one of them.

```mermaid
flowchart LR
  inA["in_A = 1"] --> p["AND / OR / **XOR** [FILL]\nslot_p"]
  inB["in_B = 0"] --> p
  p --> pOut["out_U = 1"]
  inC["in_C = 1"] --> q["**OR** / XOR / NAND [FILL]\nslot_q"]
  inD["in_D = 1"] --> q
  q --> qOut["out_V = 1"]
  inE["in_E = 1"] --> r["NOR [FILL]\nslot_r"]
  inF["in_F = 0"] --> r
  r --> rOut["out_X = 0"]
  p --> s["XNOR [FILL]\nslot_s"]
  q --> s
  r --> t["NAND [FILL]\nslot_t"]
  inE --> t
  t --> tOut["out_W = 1"]
  s --> output["AND [FILL]\nslot_output"]
  t --> output
  output --> out["out_Y = 1"]
```

## Level 10: The Grand Finale

Inputs: `in_A=1`, `in_B=0`, `in_C=1`, `in_D=1`, `in_E=0`, `in_F=1`, `in_G=0`, `in_H=1`  
Targets: `out_V=1`, `out_W=0`, `out_X=1`, `out_Y=1`

The only AND and the only OR in the palette are already placed on the board.

```mermaid
flowchart LR
  inA["in_A = 1"] --> andAB["**AND** / OR / NOR [START]\nslot_and_ab"]
  inB["in_B = 0"] --> andAB
  inC["in_C = 1"] --> xorCD["XOR [START]\nslot_xor_cd"]
  inD["in_D = 1"] --> xorCD
  inE["in_E = 0"] --> orEF["OR [START]\nslot_or_ef"]
  inF["in_F = 1"] --> orEF
  inG["in_G = 0"] --> notG["NOT [START]\nslot_not_g"]
  andAB --> m1["AND / NAND / **NOR** [FILL]\nslot_m1"]
  xorCD --> m1
  m1 --> m1Out["out_V = 1"]
  orEF --> m2["XOR [FILL]\nslot_m2"]
  notG --> m2
  m2 --> m2Out["out_W = 0"]
  m1 --> m3["AND / **NAND** / NOR [FILL]\nslot_m3"]
  m2 --> m3
  m3 --> m3Out["out_X = 1"]
  m3 --> output["XNOR [FILL]\nslot_output"]
  inH["in_H = 1"] --> output
  output --> out["out_Y = 1"]
```
