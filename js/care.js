/**
 * Um cuidado completo: confere o suprimento (ração, água, remédio), aplica no gatinho,
 * gasta a dose e paga as moedas. Fica separado do main.js para poder ser testado.
 */
Gatinho.Care = {
  /** Retorna { ok, ... } igual a Pet.care, com coins e supply quando deu certo. */
  perform(actionKey, { pet, profile }) {
    const { actions, supplies } = Gatinho.CONFIG;
    const action = actions[actionKey];
    if (action.supply && pet.alive && !profile.hasSupply(action.supply)) return { ok: false, message: supplies.empty[action.supply] };

    const result = pet.care(actionKey); // recusa antes de gastar a dose (sem fome, não está doente...)
    if (!result.ok) return result;
    if (action.supply) profile.useSupply(action.supply);
    result.coins = profile.recordCare(actionKey, result);
    return result;
  },
};
