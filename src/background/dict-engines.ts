/**
 * Static imports for all dictionary engines.
 * Service workers cannot use dynamic import(), so all engines must be statically imported.
 */

import * as ahdict from '@/components/dictionaries/ahdict/engine'
import * as baidu from '@/components/dictionaries/baidu/engine'
import * as bing from '@/components/dictionaries/bing/engine'
import * as caiyun from '@/components/dictionaries/caiyun/engine'
import * as cambridge from '@/components/dictionaries/cambridge/engine'
import * as cnki from '@/components/dictionaries/cnki/engine'
import * as cobuild from '@/components/dictionaries/cobuild/engine'
import * as etymonline from '@/components/dictionaries/etymonline/engine'
import * as eudic from '@/components/dictionaries/eudic/engine'
import * as google from '@/components/dictionaries/google/engine'
import * as googledict from '@/components/dictionaries/googledict/engine'
import * as guoyu from '@/components/dictionaries/guoyu/engine'
import * as hjdict from '@/components/dictionaries/hjdict/engine'
import * as jikipedia from '@/components/dictionaries/jikipedia/engine'
import * as jukuu from '@/components/dictionaries/jukuu/engine'
import * as lexico from '@/components/dictionaries/lexico/engine'
import * as liangan from '@/components/dictionaries/liangan/engine'
import * as longman from '@/components/dictionaries/longman/engine'
import * as macmillan from '@/components/dictionaries/macmillan/engine'
import * as merriamwebster from '@/components/dictionaries/merriamwebster/engine'
import * as mojidict from '@/components/dictionaries/mojidict/engine'
import * as naver from '@/components/dictionaries/naver/engine'
import * as oaldict from '@/components/dictionaries/oaldict/engine'
import * as renren from '@/components/dictionaries/renren/engine'
import * as shanbay from '@/components/dictionaries/shanbay/engine'
import * as sogou from '@/components/dictionaries/sogou/engine'
import * as tencent from '@/components/dictionaries/tencent/engine'
import * as urban from '@/components/dictionaries/urban/engine'
import * as vocabulary from '@/components/dictionaries/vocabulary/engine'
import * as weblio from '@/components/dictionaries/weblio/engine'
import * as weblioejje from '@/components/dictionaries/weblioejje/engine'
import * as websterlearner from '@/components/dictionaries/websterlearner/engine'
import * as wikipedia from '@/components/dictionaries/wikipedia/engine'
import * as youdao from '@/components/dictionaries/youdao/engine'
import * as youdaotrans from '@/components/dictionaries/youdaotrans/engine'
import * as zdic from '@/components/dictionaries/zdic/engine'

import { DictID } from '@/app-config'

// Type for dictionary engine
type DictEngine = {
  search: (...args: any[]) => Promise<any>
  getSrcPage: (...args: any[]) => string
}

// Map of all dictionary engines
const dictEngines: Record<string, DictEngine> = {
  ahdict,
  baidu,
  bing,
  caiyun,
  cambridge,
  cnki,
  cobuild,
  etymonline,
  eudic,
  google,
  googledict,
  guoyu,
  hjdict,
  jikipedia,
  jukuu,
  lexico,
  liangan,
  longman,
  macmillan,
  merriamwebster,
  mojidict,
  naver,
  oaldict,
  renren,
  shanbay,
  sogou,
  tencent,
  urban,
  vocabulary,
  weblio,
  weblioejje,
  websterlearner,
  wikipedia,
  youdao,
  youdaotrans,
  zdic,
}

/**
 * Get dictionary engine by ID - static version for service workers
 */
export function getDictEngine(id: DictID): DictEngine | undefined {
  return dictEngines[id]
}
