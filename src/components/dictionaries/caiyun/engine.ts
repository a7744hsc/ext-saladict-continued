import { SearchFunction, GetSrcPageFunction } from '../helpers'
import memoizeOne from 'memoize-one'
import { Caiyun } from '@opentranslate/caiyun'
import {
  MachineTranslateResult,
  MachineTranslatePayload,
  getMTArgs,
  machineResult
} from '@/components/MachineTrans/engine'
import { getTranslator as getBaiduTranslator } from '../baidu/engine'
import { CaiyunLanguage } from './config'

export const getTranslator = memoizeOne(
  () =>
    new Caiyun({
      env: 'ext',
      config: process.env.CAIYUN_TOKEN
        ? {
            token: process.env.CAIYUN_TOKEN
          }
        : undefined
    })
)

export const getSrcPage: GetSrcPageFunction = () => {
  return 'https://fanyi.caiyunapp.com/'
}

export type CaiyunResult = MachineTranslateResult<'caiyun'>

export const search: SearchFunction<
  CaiyunResult,
  MachineTranslatePayload<CaiyunLanguage>
> = async (rawText, config, profile, payload) => {
  const translator = getTranslator()
  const langcodes = translator.getSupportLanguages()

  let { sl, tl, text } = await getMTArgs(
    translator,
    rawText,
    profile.dicts.all.caiyun,
    config,
    payload
  )

  const baiduTranslator = getBaiduTranslator()

  // Only use Baidu for language detection if user has configured Baidu API
  const baiduAppid = config.dictAuth.baidu.appid
  const baiduKey = config.dictAuth.baidu.key
  const hasBaiduCredentials = !!(baiduAppid && baiduKey)

  if (hasBaiduCredentials) {
    try {
      // Caiyun's lang detection is broken
      const baiduResult = await baiduTranslator.translate(text, sl, tl, {
        appid: baiduAppid,
        key: baiduKey
      })
      if (langcodes.includes(baiduResult.from)) {
        sl = baiduResult.from
      }
    } catch (e) {}
  }

  const caiYunToken = config.dictAuth.caiyun.token
  const caiYunConfig = caiYunToken ? { token: caiYunToken } : undefined

  try {
    const result = await translator.translate(text, sl, tl, caiYunConfig)

    // Only use Baidu TTS if user has configured Baidu API
    if (hasBaiduCredentials) {
      try {
        result.origin.tts = await baiduTranslator.textToSpeech(
          result.origin.paragraphs.join('\n'),
          result.from
        )
        result.trans.tts = await baiduTranslator.textToSpeech(
          result.trans.paragraphs.join('\n'),
          result.to
        )
      } catch (e) {}
    }
    return machineResult(
      {
        result: {
          id: 'caiyun',
          sl: result.from,
          tl: result.to,
          slInitial: profile.dicts.all.caiyun.options.slInitial,
          searchText: result.origin,
          trans: result.trans
        },
        audio: {
          py: result.trans.tts,
          us: result.trans.tts
        }
      },
      langcodes
    )
  } catch (e) {
    return machineResult(
      {
        result: {
          id: 'caiyun',
          sl,
          tl,
          slInitial: 'hide',
          searchText: { paragraphs: [''] },
          trans: { paragraphs: [''] }
        }
      },
      translator.getSupportLanguages()
    )
  }
}
