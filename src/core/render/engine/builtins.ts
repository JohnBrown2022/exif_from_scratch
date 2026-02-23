import classicFooterRaw from '../defs/classic_footer.json';
import ezmarkCardRaw from '../defs/ezmark_card.json';
import picsealBannerRaw from '../defs/picseal_banner.json';
import lightroomFooterRaw from '../defs/lightroom_footer.json';
import monitorBarRaw from '../defs/monitor_bar.json';
import shotOnRaw from '../defs/shot_on.json';
import cinemascopeRaw from '../defs/cinemascope.json';
import bottomBarRaw from '../defs/bottom_bar.json';
import infoBlockRaw from '../defs/info_block.json';
import filmRaw from '../defs/film.json';
import minimalCornerRaw from '../defs/minimal_corner.json';

import { parseTemplateJson } from './fromJson';
import type { TemplateJson } from './types';

const builtinTemplates: Record<string, TemplateJson> = {
  classic_footer: parseTemplateJson(classicFooterRaw),
  ezmark_card: parseTemplateJson(ezmarkCardRaw),
  picseal_banner: parseTemplateJson(picsealBannerRaw),
  lightroom_footer: parseTemplateJson(lightroomFooterRaw),
  monitor_bar: parseTemplateJson(monitorBarRaw),
  shot_on: parseTemplateJson(shotOnRaw),
  cinemascope: parseTemplateJson(cinemascopeRaw),
  bottom_bar: parseTemplateJson(bottomBarRaw),
  info_block: parseTemplateJson(infoBlockRaw),
  film: parseTemplateJson(filmRaw),
  minimal_corner: parseTemplateJson(minimalCornerRaw),
};

export function getBuiltinTemplateJson(id: string): TemplateJson | null {
  return builtinTemplates[id] ?? null;
}

export function listBuiltinTemplateJson(): TemplateJson[] {
  return Object.values(builtinTemplates);
}
