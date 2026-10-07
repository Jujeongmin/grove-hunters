import { useState } from "react";
import { itemName } from "./names";
import { RECIPES, type Recipe } from "../game/account/forge";
import type { BagView } from "../game/account/items";
import { allStacks } from "../game/account/inventory";
import type { WorldClient } from "../net/worldClient";
import { problemText } from "./BagPanel";
import { t } from "./lang";
import { playCue } from "../game/audio/sfx";
import { CraftStage, Purse, RecipeRack, SideSheet } from "./Anvil";

// The forge, from the menu anywhere (or from the village smith): making gear and potions from what
// monsters drop. The recipes stand in the column on the right; the one picked is on the anvil on the
// left with each thing it takes against what you have. (Enhancing is done from the bag.)
export function SmithPanel({ client, bag, onClose }: { client: WorldClient; bag: BagView | null; onClose: () => void }) {
  const [recipeId, setRecipeId] = useState<string>(RECIPES[0].id);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: "good" | "bad" } | null>(null);
  const stacks = bag ? allStacks(bag) : {};
  const recipe = RECIPES.find((r) => r.id === recipeId) ?? RECIPES[0];

  const craft = (made: Recipe) => {
    const name = itemName(made.makes);
    setBusy(true);
    setNote(null);
    void client.craft(made.id).then((code) => {
      setBusy(false);
      setNote(code ? { text: problemText(code)!, tone: "bad" } : { text: t("forge.crafted", { name }), tone: "good" });
      if (!code) playCue("enhance_ok");
    });
  };

  return (
    <SideSheet
      title={t("forge.title")} onClose={onClose}
      side={(
        <>
          <Purse bag={bag} />
          {bag && (
            <RecipeRack
              stacks={stacks} gold={bag.gold} picked={recipe.id}
              onPick={(id) => {
                setRecipeId(id);
                setNote(null);
              }}
            />
          )}
        </>
      )}
    >
      {!bag ? <p className="note">{t("common.loading")}</p> : (
        <CraftStage recipe={recipe} bag={bag} stacks={stacks} busy={busy} onCraft={() => craft(recipe)} />
      )}
      {note && <p className={`forge-note ${note.tone}`}>{note.text}</p>}
    </SideSheet>
  );
}
