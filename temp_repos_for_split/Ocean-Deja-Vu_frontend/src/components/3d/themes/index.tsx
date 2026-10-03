import React from 'react';
import { Biome } from '../../../utils/buildDiveConfig';

import SunlitTheme, * as Sunlit from './sunlit';
import ReefTheme, * as Reef from './reef';
import SeagrassTheme, * as Seagrass from './seagrass';
import OpenOceanTheme, * as OpenOcean from './openOcean';
import MonsoonBloomTheme, * as MonsoonBloom from './monsoonBloom';
import ArabianUpwellingTheme, * as Arabian from './arabian';
import BengalPlumeTheme, * as Bengal from './bengal';
import ThermoclineTheme, * as Thermocline from './thermocline';
import OMZTheme, * as OMZ from './omz';
import MesopelagicTheme, * as Mesopelagic from './mesopelagic';
import DeepPelagicTheme, * as DeepPelagic from './deepPelagic';
import AbyssalTheme, * as Abyssal from './abyssal';
import TrenchTheme, * as Trench from './trench';
import VentTheme, * as Vent from './vent';
import SeepTheme, * as Seep from './seep';
import CycloneTheme, * as Cyclone from './cyclone';
import EddyTheme, * as Eddy from './eddy';
import HeatwaveTheme, * as Heatwave from './heatwave';
import NightTheme, * as Night from './night';
import NightBloomTheme, * as NightBloom from './nightBloom';

export {
  Sunlit,
  Reef,
  Seagrass,
  OpenOcean,
  MonsoonBloom,
  Arabian,
  Bengal,
  Thermocline,
  OMZ,
  Mesopelagic,
  DeepPelagic,
  Abyssal,
  Trench,
  Vent,
  Seep,
  Cyclone,
  Eddy,
  Heatwave,
  Night,
  NightBloom,
};

export const THEME_COMPONENTS: Record<Biome, React.ComponentType<{ currentDepth: number; bleachFactor?: number }>> = {
  sunlit: SunlitTheme,
  reef: ReefTheme,
  seagrass: SeagrassTheme,
  openOcean: OpenOceanTheme,
  monsoonBloom: MonsoonBloomTheme,
  arabian: ArabianUpwellingTheme,
  bengal: BengalPlumeTheme,
  thermocline: ThermoclineTheme,
  omz: OMZTheme,
  mesopelagic: MesopelagicTheme,
  deepPelagic: DeepPelagicTheme,
  abyssal: AbyssalTheme,
  trench: TrenchTheme,
  vent: VentTheme,
  seep: SeepTheme,
  cyclone: CycloneTheme,
  eddy: EddyTheme,
  heatwave: HeatwaveTheme,
  night: NightTheme,
  nightBloom: NightBloomTheme,
};

export const BiomeThemeRenderer: React.FC<{
  biome: Biome;
  currentDepth: number;
  bleachFactor?: number;
}> = ({ biome, currentDepth, bleachFactor }) => {
  const Component = THEME_COMPONENTS[biome] || SunlitTheme;
  return <Component currentDepth={currentDepth} bleachFactor={bleachFactor} />;
};
