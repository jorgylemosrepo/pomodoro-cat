/**
 * CONQUISTAS. Para criar uma nova, basta adicionar um item na lista (sem mexer em código).
 *
 *   id     identificador único (não mude depois de publicado, é o que fica salvo)
 *   icon   nome de um ícone de Gatinho.html.ICONS (js/html.js)
 *   title  nome curto
 *   desc   o que fazer
 *   coins  recompensa em moedas
 *   when   { counter, atLeast }: desbloqueia quando o contador chega no valor
 *
 * Contadores disponíveis (ver js/profile.js):
 *   focusSessions, focusMinutes, longestFocus, cancels,
 *   careTotal, care:feed, care:water, care:play, care:pet, urgentSaves,
 *   goalsMet, bestStreak, bestCombo, deaths, revives, coinsEarned,
 *   purchases, coinsSpent, coatChanges, themeChanges, sceneChanges, equips, maxSlotsEquipped,
 *   care:clean, care:medicine, bestLifeDays, rareEvents,
 *   missionsDone, allMissionsDays, habits, breaksTaken, furniturePlaced, suppliesBought
 *
 * (Está em .js e não em .json porque o navegador bloqueia ler arquivos .json
 *  quando a página é aberta direto do disco.)
 */
window.Gatinho = window.Gatinho || {};

Gatinho.ACHIEVEMENTS = [
  { id: 'first_focus',  icon: 'clock',    title: 'Primeiro foco',      desc: 'Conclua 1 foco.',                          coins: 10,  when: { counter: 'focusSessions', atLeast: 1 } },
  { id: 'focus_10',     icon: 'clock',    title: 'Pegando o ritmo',    desc: 'Conclua 10 focos.',                        coins: 30,  when: { counter: 'focusSessions', atLeast: 10 } },
  { id: 'focus_50',     icon: 'trophy',   title: 'Mestre do foco',     desc: 'Conclua 50 focos.',                        coins: 100, when: { counter: 'focusSessions', atLeast: 50 } },
  { id: 'minutes_100',  icon: 'bolt',     title: 'Cem minutos',        desc: 'Acumule 100 minutos de foco.',             coins: 25,  when: { counter: 'focusMinutes', atLeast: 100 } },
  { id: 'minutes_1000', icon: 'flame',    title: 'Mil minutos',        desc: 'Acumule 1000 minutos de foco.',            coins: 150, when: { counter: 'focusMinutes', atLeast: 1000 } },
  { id: 'marathon',     icon: 'flame',    title: 'Maratona',           desc: 'Conclua um foco de 50 minutos ou mais.',   coins: 40,  when: { counter: 'longestFocus', atLeast: 50 } },
  { id: 'deep_work',    icon: 'shield',   title: 'Foco profundo',      desc: 'Conclua um foco de 90 minutos ou mais.',   coins: 80,  when: { counter: 'longestFocus', atLeast: 90 } },
  { id: 'first_care',   icon: 'paw',      title: 'Mãozinha',           desc: 'Cuide do gatinho pela primeira vez.',      coins: 5,   when: { counter: 'careTotal', atLeast: 1 } },
  { id: 'feed_10',      icon: 'bowl',     title: 'Barriguinha cheia',  desc: 'Dê ração 10 vezes.',                       coins: 20,  when: { counter: 'care:feed', atLeast: 10 } },
  { id: 'water_10',     icon: 'drop',     title: 'Hidratado',          desc: 'Dê água 10 vezes.',                        coins: 20,  when: { counter: 'care:water', atLeast: 10 } },
  { id: 'play_10',      icon: 'ball',     title: 'Brincalhão',         desc: 'Brinque com ele 10 vezes.',                coins: 20,  when: { counter: 'care:play', atLeast: 10 } },
  { id: 'pet_10',       icon: 'heart',    title: 'Dengoso',            desc: 'Faça carinho 10 vezes.',                   coins: 20,  when: { counter: 'care:pet', atLeast: 10 } },
  { id: 'care_100',     icon: 'star',     title: 'Tutor dedicado',     desc: 'Faça 100 cuidados no total.',              coins: 100, when: { counter: 'careTotal', atLeast: 100 } },
  { id: 'lifesaver',    icon: 'shield',   title: 'Por um fio',         desc: 'Cuide dele quando já estava bravo.',       coins: 25,  when: { counter: 'urgentSaves', atLeast: 1 } },
  { id: 'goal_1',       icon: 'target',   title: 'Meta batida',        desc: 'Bata a meta diária de foco.',              coins: 20,  when: { counter: 'goalsMet', atLeast: 1 } },
  { id: 'goal_7',       icon: 'calendar', title: 'Semana de metas',    desc: 'Bata a meta diária 7 vezes.',              coins: 80,  when: { counter: 'goalsMet', atLeast: 7 } },
  { id: 'streak_3',     icon: 'flame',    title: 'Em chamas',          desc: 'Bata a meta 3 dias seguidos.',             coins: 30,  when: { counter: 'bestStreak', atLeast: 3 } },
  { id: 'streak_7',     icon: 'trophy',   title: 'Sequência de ouro',  desc: 'Bata a meta 7 dias seguidos.',             coins: 100, when: { counter: 'bestStreak', atLeast: 7 } },
  { id: 'combo_3',      icon: 'bolt',     title: 'Combo!',             desc: 'Conclua 3 focos seguidos sem cancelar.',   coins: 20,  when: { counter: 'bestCombo', atLeast: 3 } },
  { id: 'decorator',    icon: 'star',     title: 'Decorador',          desc: 'Troque o tema da janela.',                    coins: 20,  when: { counter: 'themeChanges', atLeast: 1 } },
  { id: 'stage_manager', icon: 'star',    title: 'Diretor de cena',    desc: 'Troque o cenário do gatinho.',             coins: 20,  when: { counter: 'sceneChanges', atLeast: 1 } },
  { id: 'first_purchase', icon: 'bag',   title: 'Primeira compra',    desc: 'Compre um item na loja.',                  coins: 15,  when: { counter: 'purchases', atLeast: 1 } },
  { id: 'new_look',     icon: 'paw',      title: 'Novo visual',        desc: 'Troque a cor do pelo do gatinho.',         coins: 20,  when: { counter: 'coatChanges', atLeast: 1 } },
  { id: 'fashionista',  icon: 'star',     title: 'Fashionista',        desc: 'Use chapéu, rosto e pescoço ao mesmo tempo.', coins: 60, when: { counter: 'maxSlotsEquipped', atLeast: 3 } },
  { id: 'collector',    icon: 'box',      title: 'Colecionador',       desc: 'Compre 12 itens.',                         coins: 100, when: { counter: 'purchases', atLeast: 12 } },
  { id: 'big_spender',  icon: 'coin',     title: 'Mão aberta',         desc: 'Gaste 300 moedas na loja.',                coins: 50,  when: { counter: 'coinsSpent', atLeast: 300 } },
  { id: 'rich',         icon: 'coin',     title: 'Cofre cheio',        desc: 'Ganhe 1000 moedas no total.',              coins: 100, when: { counter: 'coinsEarned', atLeast: 1000 } },
  { id: 'week_alive',   icon: 'calendar', title: 'Primeira semana',    desc: 'Mantenha o gatinho vivo por 7 dias.',      coins: 40,  when: { counter: 'bestLifeDays', atLeast: 7 } },
  { id: 'veteran',      icon: 'shield',   title: 'Veterano',           desc: 'Mantenha o gatinho vivo por 30 dias.',     coins: 150, when: { counter: 'bestLifeDays', atLeast: 30 } },
  { id: 'elder',        icon: 'heart',    title: 'Longa vida',         desc: 'Mantenha o gatinho vivo por 60 dias.',     coins: 300, when: { counter: 'bestLifeDays', atLeast: 60 } },
  { id: 'nurse',        icon: 'heart',    title: 'Enfermeiro',         desc: 'Cure o gatinho com remédio.',              coins: 20,  when: { counter: 'care:medicine', atLeast: 1 } },
  { id: 'cleaner',      icon: 'star',     title: 'Faxineiro',          desc: 'Limpe a caixinha 10 vezes.',               coins: 20,  when: { counter: 'care:clean', atLeast: 10 } },
  { id: 'surprise',     icon: 'star',     title: 'Imprevisível',       desc: 'Presencie um evento raro.',                coins: 20,  when: { counter: 'rareEvents', atLeast: 1 } },
  { id: 'first_mission', icon: 'target',   title: 'Missão cumprida',    desc: 'Complete uma missão do dia.',              coins: 10,  when: { counter: 'missionsDone', atLeast: 1 } },
  { id: 'mission_week', icon: 'calendar', title: 'Dia perfeito x7',    desc: 'Complete as 3 missões do dia em 7 dias.',  coins: 80,  when: { counter: 'allMissionsDays', atLeast: 7 } },
  { id: 'self_care',    icon: 'heart',    title: 'Cuide-se',           desc: 'Faça 10 hábitos saudáveis na pausa.',      coins: 40,  when: { counter: 'habits', atLeast: 10 } },
  { id: 'break_5',      icon: 'clock',    title: 'Pausa merecida',     desc: 'Termine 5 pausas.',                        coins: 25,  when: { counter: 'breaksTaken', atLeast: 5 } },
  { id: 'home_sweet',   icon: 'box',      title: 'Lar doce lar',       desc: 'Coloque um móvel no cenário.',             coins: 15,  when: { counter: 'furniturePlaced', atLeast: 1 } },
  { id: 'full_house',   icon: 'star',     title: 'Casa decorada',      desc: 'Coloque 6 móveis nos cenários.',           coins: 60,  when: { counter: 'furniturePlaced', atLeast: 6 } },
  { id: 'phoenix',      icon: 'medal',    title: 'Fênix',              desc: 'Reviva o gatinho.',                        coins: 10,  when: { counter: 'revives', atLeast: 1 } },
];
