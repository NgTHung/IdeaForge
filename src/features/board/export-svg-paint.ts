const svgPaintProperties = [
  "color",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "stop-color",
  "stop-opacity",
] as const;

type SavedProperty = { value: string; priority: string };

export function inlineSvgPaintForExport(root: ParentNode): () => void {
  const originalStyles = new Map<SVGElement, Map<string, SavedProperty>>();

  const restore = () => {
    for (const [element, properties] of originalStyles) {
      for (const [property, original] of properties) {
        if (original.value) element.style.setProperty(property, original.value, original.priority);
        else element.style.removeProperty(property);
      }
    }
  };

  try {
    const svgChildren = root.querySelectorAll<SVGElement>(".border-decorations svg *, .cloud-frame svg *");
    for (const element of svgChildren) {
      const computed = getComputedStyle(element);
      const savedProperties = new Map<string, SavedProperty>();
      originalStyles.set(element, savedProperties);

      for (const property of svgPaintProperties) {
        const value = computed.getPropertyValue(property);
        if (!value) continue;
        savedProperties.set(property, {
          value: element.style.getPropertyValue(property),
          priority: element.style.getPropertyPriority(property),
        });
        element.style.setProperty(property, value, "important");
      }
    }
  } catch (error) {
    restore();
    throw error;
  }

  return restore;
}
