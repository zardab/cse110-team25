# Level Circuit Diagrams

These diagrams show the intended circuit wiring for each level. `[START]`
means the gate is already placed when the level begins. `[FILL]` means the
slot starts empty and the player must place that gate. Every output light is a
declared target, including intermediate outputs.

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
  inC["in_C = 1"] --> orInput["OR [START]\nslot_or"]
  inD["in_D = 1"] --> orInput
  orInput --> orOut["out_W = 1"]
  inE["in_E = 0"] --> xor["XOR [START]\nslot_xor"]
  inF["in_F = 0"] --> xor
  inF --> nor["NOR [START]\nslot_nor"]
  inG["in_G = 0"] --> nor
  nor --> norOut["out_X = 1"]
  andInput --> nand["NAND [FILL]\nslot_nand"]
  nor --> nand
  inC --> not["NOT [FILL]\nslot_not"]
  xor --> xnor["XNOR [FILL]\nslot_xnor"]
  not --> xnor
  xnor --> xnorOut["out_Z = 1"]
  nand --> finalOr["OR [FILL]\nslot_or_final"]
  xnor --> finalOr
  finalOr --> output["AND [FILL]\nslot_output"]
  inH["in_H = 1"] --> output
  output --> out["out_Y = 1"]
```
