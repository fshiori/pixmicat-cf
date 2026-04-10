/**
 * Field Trap Utilities
 * 欄位陷阱工具 - 生成隨機欄位名稱以防止 spam bot
 * 參考 Pixmicat! 的實作
 */

export interface FieldTrapConfig {
  name: string;
  email: string;
  subject: string;
  comment: string;
}

/**
 * 生成隨機欄位名稱
 * 格式：6-10 個英數大小寫字元，第一位不能是數字
 */
function generateFieldName(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const firstChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

  let name = '';
  // 第一位：字母
  name += firstChars.charAt(Math.floor(Math.random() * firstChars.length));

  // 後續位：6-9 個字元（總共 7-10 個），只使用字母
  const length = 6 + Math.floor(Math.random() * 4); // 6-9
  for (let i = 0; i < length; i++) {
    name += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return name;
}

/**
 * 生成一組欄位陷阱名稱
 */
export function generateFieldTrapNames(): FieldTrapConfig {
  return {
    name: generateFieldName(),
    email: generateFieldName(),
    subject: generateFieldName(),
    comment: generateFieldName(),
  };
}

/**
 * 生成預設的欄位陷阱名稱（對應 ref 的實作）
 * 這些是 ref 版本中使用的預設值，可以選擇使用或隨機生成
 */
export function getDefaultFieldTrapNames(): FieldTrapConfig {
  return {
    name: 'bvUFbdrIC',
    email: 'ObHGyhdTR',
    subject: 'SJBgiFbhj',
    comment: 'pOBvrtyJK',
  };
}

/**
 * Honeypot 欄位配置
 * 這些是吸引 spam bot 的陷阱欄位
 */
export interface HoneypotConfig {
  name: string;
  email: string;
  subject: string;
  comment: string;
  reply: string;
}

export function getHoneypotNames(): HoneypotConfig {
  return {
    name: 'hp_website',
    email: 'hp_url',
    subject: 'hp_company',
    comment: 'hp_comment',
    reply: 'hp_reply',
  };
}

/**
 * 驗證 honeypot 欄位是否為空
 * 如果任何 honeypot 欄位有值，則可能是 spam bot
 */
export function validateHoneypot(
  formData: FormData | Record<string, any>, 
  honeypotConfig?: HoneypotConfig
): { valid: boolean; triggered: number; errors: string[] } {
  const honeypotNames = honeypotConfig || getHoneypotNames();
  const errors: string[] = [];
  let triggered = 0;

  for (const [key, name] of Object.entries(honeypotNames)) {
    let value: any;
    
    if (formData instanceof FormData) {
      value = formData.get(name);
    } else {
      value = formData[name];
    }
    
    if (value !== null && value !== undefined && value !== '' && value !== 'false') {
      // honeypot 欄位被填寫了，可能是 bot
      triggered++;
      errors.push(`Honeypot field ${key} was filled: ${name}`);
    }
  }

  return {
    valid: triggered === 0,
    triggered,
    errors,
  };
}

/**
 * 驗證欄位陷阱
 * 檢查表單是否使用了正確的隨機欄位名稱
 */
export function verifyFieldTrap(
  formData: FormData | Record<string, any>, 
  fieldConfig: FieldTrapConfig
): { valid: boolean; triggered: number; errors: string[] } {
  const errors: string[] = [];
  let triggered = 0;
  
  // 檢查是否使用了舊的固定欄位名稱
  const oldFieldNames = ['name', 'email', 'subject', 'comment'];
  for (const oldName of oldFieldNames) {
    let hasOldField = false;
    
    if (formData instanceof FormData) {
      hasOldField = formData.has(oldName) && formData.get(oldName) !== '';
    } else {
      hasOldField = oldName in formData && formData[oldName] !== '';
    }
    
    if (hasOldField) {
      triggered++;
      errors.push('Detected old field names');
    }
  }
  
  // 檢查是否缺少必需的隨機欄位
  const requiredFields = ['name', 'email', 'subject', 'comment'];
  for (const [key, randomName] of Object.entries(fieldConfig)) {
    if (requiredFields.includes(key)) {
      let hasField = false;
      
      if (formData instanceof FormData) {
        hasField = formData.has(randomName);
      } else {
        hasField = randomName in formData;
      }
      
      if (!hasField) {
        triggered++;
        errors.push(`Missing required field: ${key}`);
      }
    }
  }
  
  return {
    valid: triggered === 0,
    triggered,
    errors,
  };
}
