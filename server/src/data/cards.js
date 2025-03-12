/**
 * Примеры карт для демонстрации и инициализации базы данных
 * Соответствуют сценарию из игрового режима Rhyme Master
 */

const cards = [
  // Атакующие карты
  {
    name: "Огненный Поток",
    couplet: "Мои рифмы – огонь, ты в моём пламени таешь,\nВ твоём взгляде страх, ведь ты знаешь – проиграешь.",
    type: "attack",
    power: 5,
    description: "Агрессивная атака с огненной тематикой",
    effects: [
      {
        type: "damage",
        value: 5,
        description: "Наносит базовый урон 5 очков"
      }
    ],
    image: "/images/cards/fire_flow.png",
    tags: ["огонь", "агрессия"],
    rarity: "rare"
  },
  {
    name: "Ледяной Панч",
    couplet: "Ледяной мой панч: он твой пыл остудит,\nТы застыл от страха – мой стиль тебя победит.",
    type: "attack",
    power: 4,
    description: "Атака с ледяной тематикой, контрастирующая с огненными атаками",
    effects: [
      {
        type: "damage",
        value: 4,
        description: "Наносит базовый урон 4 очка"
      }
    ],
    image: "/images/cards/ice_punch.png",
    tags: ["лёд", "контраст"],
    rarity: "uncommon"
  },
  {
    name: "Контрольный Выстрел",
    couplet: "Мой финальный куплет – как контрольный выстрел в бит,\nТы повержен окончательно, мой стих над ареной звенит.",
    type: "attack",
    power: 6,
    description: "Мощный финальный панч для завершения баттла",
    effects: [
      {
        type: "damage",
        value: 6,
        description: "Наносит высокий урон 6 очков"
      }
    ],
    image: "/images/cards/final_shot.png",
    tags: ["финал", "выстрел"],
    rarity: "epic"
  },
  {
    name: "Рифмовая Граната",
    couplet: "Думал, что победил? Рано радоваться, брат,\nМои рифмы – граната, взорвут твой победный парад.",
    type: "attack",
    power: 6,
    description: "Мощный завершающий удар для финального рывка",
    effects: [
      {
        type: "damage",
        value: 6,
        description: "Наносит высокий урон 6 очков"
      }
    ],
    image: "/images/cards/rhyme_grenade.png",
    tags: ["граната", "взрыв"],
    rarity: "epic"
  },

  // Защитные карты
  {
    name: "Словесный Щит",
    couplet: "Мой щит ставит блок – твой огонь угасает,\nТвой пустой выпендрёж на меня не влияет.",
    type: "defense",
    power: 3,
    description: "Карта-блок, способная гасить атаку противника",
    effects: [
      {
        type: "block",
        value: 3,
        description: "Блокирует до 3 очков урона от атаки противника"
      }
    ],
    image: "/images/cards/word_shield.png",
    tags: ["щит", "блок"],
    rarity: "uncommon"
  },
  {
    name: "Железный Занавес",
    couplet: "Твой панч отскочил – мой щит его отразил без труда,\nОн слишком слаб: толпа зевает, не видит в нём вреда.",
    type: "defense",
    power: 4,
    description: "Мощная защитная карта для блокировки куплета оппонента",
    effects: [
      {
        type: "block",
        value: 4,
        description: "Блокирует до 4 очков урона от атаки противника"
      }
    ],
    image: "/images/cards/iron_curtain.png",
    tags: ["защита", "железо"],
    rarity: "rare"
  },

  // Комбо карты
  {
    name: "Лирический Шторм",
    couplet: "Над ареной шторм стихов – тебе некуда бежать,\nМои рифмы хлещут нещадно, заставляют тебя дрожать.",
    type: "combo",
    power: 3,
    description: "Карта для комбо, позволяющая сыграть дополнительный куплет",
    effects: [
      {
        type: "damage",
        value: 3,
        description: "Наносит средний урон 3 очка"
      },
      {
        type: "chain",
        value: 1,
        description: "Позволяет сыграть ещё одну карту сразу после этой"
      }
    ],
    image: "/images/cards/lyrical_storm.png",
    tags: ["шторм", "комбо"],
    rarity: "rare"
  },
  {
    name: "Громовой Разряд",
    couplet: "Падают строки, как гром – мой финальный разряд,\nТвой голос затих – это мой победный заряд.",
    type: "combo",
    power: 3,
    description: "Карта, усиливающая эффект предыдущего куплета",
    effects: [
      {
        type: "damage",
        value: 3,
        description: "Наносит средний урон 3 очка"
      },
      {
        type: "combo",
        value: 2,
        description: "Добавляет 2 дополнительных очка урона, если сыграна после 'Лирического Шторма'"
      }
    ],
    image: "/images/cards/thunder_discharge.png",
    tags: ["гром", "разряд"],
    requiredTag: "шторм",
    rarity: "rare"
  },

  // Специальные карты
  {
    name: "Точный Панч",
    couplet: "Шум и гром – а толку ноль, твой стиль – одна витрина,\nМой панч бьёт в цель: ты повержен, тут моя вершина.",
    type: "special",
    power: 4,
    description: "Спец-куплет, наносящий точечный удар и отменяющий бонусы от комбо соперника",
    effects: [
      {
        type: "damage",
        value: 4,
        description: "Наносит средний урон 4 очка"
      },
      {
        type: "cancel_combo",
        value: 0,
        description: "Отменяет последний бонусный эффект от комбо противника"
      }
    ],
    image: "/images/cards/precise_punch.png",
    tags: ["точность", "отмена"],
    rarity: "epic"
  },
  {
    name: "Импровизация",
    couplet: "Меняю правила игры, ты не готов к такому повороту,\nНовая тема, новый флоу – я разрушаю твою ноту.",
    type: "special",
    power: 3,
    description: "Особая карта, которая может изменить ход баттла",
    effects: [
      {
        type: "damage",
        value: 3,
        description: "Наносит средний урон 3 очка"
      },
      {
        type: "special",
        value: 0,
        description: "Изменяет тему баттла, накладывая случайный эффект на следующий раунд"
      }
    ],
    image: "/images/cards/improvisation.png",
    tags: ["импровизация", "изменение"],
    rarity: "legendary"
  }
];

module.exports = cards; 