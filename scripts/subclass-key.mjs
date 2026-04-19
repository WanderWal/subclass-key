/** Allow subclass in Item Grant / Item Choice, and set granted subclass system.classIdentifier to the actor's class. */

const PATCH_KEY = "_featSubclassGrantPatched";

Hooks.once("init", () => {
  if (game.system?.id !== "dnd5e") return;

  const itemGrantCls = CONFIG.DND5E?.advancementTypes?.ItemGrant?.documentClass;
  if (!itemGrantCls?.VALID_TYPES || itemGrantCls.prototype.apply[PATCH_KEY]) return;

  itemGrantCls.VALID_TYPES.add("subclass");

  const filteredKeys =
    globalThis.dnd5e?.utils?.filteredKeys
    ?? ((obj) => Object.entries(obj ?? {}).filter(([, v]) => v).map(([k]) => k));

  // Parent of ItemGrantAdvancement is Advancement (the class itself, not .prototype).
  const AdvancementClass = Object.getPrototypeOf(itemGrantCls);
  if (typeof AdvancementClass !== "function" || !AdvancementClass.prototype?.createItemData) return;

  const origCreateItemData = AdvancementClass.prototype.createItemData;
  AdvancementClass.prototype.createItemData = async function (uuid, id) {
    const data = await origCreateItemData.call(this, uuid, id);
    if (!(this instanceof itemGrantCls) || data?.type !== "subclass") return data;
    applySubclassClassIdentifier(data, this);
    return data;
  };

  const origApply = itemGrantCls.prototype.apply;
  itemGrantCls.prototype.apply = async function (level, data, retainedData = {}) {
    for (const uuid of filteredKeys(data)) {
      const row = retainedData[uuid];
      if (row?.type === "subclass") applySubclassClassIdentifier(row, this);
    }
    return origApply.call(this, level, data, retainedData);
  };

  Object.defineProperty(itemGrantCls.prototype.apply, PATCH_KEY, { value: true });
});

function applySubclassClassIdentifier(itemData, advancement) {
  const cid = resolveClassIdentifierForGrantedSubclass(advancement);
  if (cid) foundry.utils.setProperty(itemData, "system.classIdentifier", cid);
}

function resolveClassIdentifierForGrantedSubclass(advancement) {
  const item = advancement.item;
  const actor = advancement.actor;
  if (!actor) return "";

  const root = item?.advancementRootItem;
  if (root?.type === "class") return root.identifier;

  const classes = actor.items.filter(i => i.type === "class");
  if (classes.length === 1) return classes[0].identifier;

  const original = classes.find(c => c.isOriginalClass);
  if (original) return original.identifier;

  return classes[0]?.identifier ?? "";
}
