use anchor_lang::prelude::*;

declare_id!("2RuBcnnCXuY7VXxCKXShXw2T5rsGc8xnV6yvdsMwjCoF");

#[program]
pub mod vestige {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
