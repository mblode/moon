import { renderZoneOgImage } from "@/app/og-image-shared";
import { OgLogo } from "@/app/og-logo";

export {
  OG_CONTENT_TYPE as contentType,
  OG_SIZE as size,
} from "@/app/og-image-shared";

export const alt = "3D Moon Phase Simulator";

/**
 * The house card (Rule 12), replacing the static `opengraph-image.jpg` and the
 * hardcoded absolute image URLs in root metadata.
 *
 * Converting the JPG to a generated route is also the Rule 11 fix, which is
 * why `metadataBase` moves to the zone URL in the same commit. A static
 * metadata image already carries `basePath`, so pointing `metadataBase` at the
 * zone while the JPG is still there produces `/moon/moon/opengraph-image.jpg`.
 * A generated route is not prefixed, so this form is the one that cannot double.
 */
export default function OpengraphImage() {
  return renderZoneOgImage({
    background: "#0b1020",
    color: "#f4f1ea",
    logo: <OgLogo />,
    title: "Moon",
  });
}
