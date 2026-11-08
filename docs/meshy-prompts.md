# Промпты для Meshy: 12 фигур

## Как генерировать

1. В Meshy откройте **Text to 3D**.
2. Каждой фигуре дайте общий стиль (блок ниже) и её собственное описание. Склейте их в одно поле промпта: сначала описание фигуры, затем стиль.
3. Если есть поле **Negative prompt**, вставьте туда негатив (ниже).
4. Настройки: стиль **Realistic**, текстуры **PBR** включены, поза **A-pose/T-pose выключена** (нужна статуя, а не персонаж для анимации).
5. Из 4 вариантов выбирайте тот, где фигура стоит прямо, целиком видна и **без постамента**: постаменты я добавлю в коде одинаковыми для всех.
6. Скачивайте в формате **GLB** и называйте файлы так, как указано у каждой фигуры (например, `w_pawn.glb`).
7. Пришлите мне все 12 файлов в этот тред.

Совет: сначала сделайте одну пешку и одного короля из каждой армии и пришлите их. Так мы проверим стиль, прежде чем тратить кредиты на остальные фигуры.

Перед публикацией игры проверьте в условиях бесплатного тарифа Meshy, как можно использовать сгенерированные модели.

---

## Общий стиль (добавлять к каждой светлой фигуре)

```
carved white marble statue, chess piece, fantasy medieval, elegant elven craftsmanship, fine sculpted details, subtle glowing pale-blue runes, polished stone, full body, standing upright, front-facing, centered, no pedestal, no base, single object, game asset
```

## Общий стиль (добавлять к каждой тёмной фигуре)

```
carved black basalt statue, chess piece, dark fantasy medieval, brutal orcish craftsmanship, rough chiselled stone, glowing ember-orange eyes and cracks, spikes, full body, standing upright, front-facing, centered, no pedestal, no base, single object, game asset
```

## Негатив (для всех)

```
pedestal, base, ground, floor, multiple objects, text, logo, cartoon, chibi, low detail, broken limbs, cropped, plastic, metal armor colors, bright colors
```

---

## Светлая армия: люди и эльфы

**`w_pawn.glb`: пешка, эльф-копейщик**
```
young elf spearman soldier, slender, long hair, pointed ears, light scale armor, holding a tall spear upright in right hand, leaf-shaped shield on left arm, calm proud stance
```

**`w_rook.glb`: ладья, белая сторожевая башня**
```
round elven watchtower, tall cylindrical stone tower with crenellated battlements on top, narrow arched windows, carved vine ornaments, small banner on top, arched wooden-style door at the bottom
```

**`w_knight.glb`: конь, боевой конь**
```
head and neck of a noble war horse, classic chess knight silhouette, flowing carved mane, ornate armored chamfron plate on the forehead, proud arched neck, bust only, no body and no legs
```

**`w_bishop.glb`: слон, эльфийский маг**
```
elven wizard in long flowing hooded robe, face hidden in shadow of a tall pointed hood, holding a long staff topped with a glowing crystal, slender tall figure
```

**`w_queen.glb`: ферзь, королева эльфов**
```
elven queen, tall and graceful, long flowing gown, long hair down her back, delicate tall crown of thin pointed spires, hands holding a small glowing orb in front of her chest
```

**`w_king.glb`: король, король людей**
```
human king, broad shoulders, long beard, heavy royal cloak with fur collar, tall crown topped with a cross, both hands resting on the hilt of a great sword planted point-down in front of him
```

## Тёмная армия: орки

**`b_pawn.glb`: пешка, орк-рубака**
```
hunched orc grunt warrior, muscular, big lower jaw with tusks, heavy brow, crude leather and plate armor with shoulder spikes, holding a crude one-handed axe
```

**`b_rook.glb`: ладья, шипастая крепость**
```
squat orcish fortress tower, tapered cylindrical tower, huge iron spikes on top and around the walls, a skull carved above the gate, glowing slit windows
```

**`b_knight.glb`: конь, варг**
```
head and neck of a giant snarling wolf (warg), classic chess knight silhouette, open jaws with sharp fangs, pointed ears laid back, bristling spiky fur along the neck, bust only, no body and no legs
```

**`b_bishop.glb`: слон, орк-шаман**
```
hunched orc shaman, ragged robe, wearing a horned animal skull mask, necklace of bones, holding a crooked staff topped with a small skull and a glowing crystal
```

**`b_queen.glb`: ферзь, колдунья орков**
```
tall orc sorceress, long jagged robe, spiked shoulder pauldrons, tall jagged crown of uneven spikes, tusks, holding a staff with a curved scythe-like blade
```

**`b_king.glb`: король, вождь орков**
```
massive orc warlord chieftain, huge shoulders with spiked pauldrons, horned helmet, thick fur collar, tusks, both hands resting on a giant cleaver blade planted in front of him
```

---

## Размеры

Неважно, какого размера модели получатся: я сам приведу их к единому масштабу (король самый высокий, пешка самая низкая) и поставлю на одинаковые каменные постаменты.
