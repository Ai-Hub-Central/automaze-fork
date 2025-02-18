import {
    ActionRowBuilder,
    bold,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChatInputCommandInteraction,
    Colors,
    ComponentType,
    EmbedBuilder,
    GuildMember,
    inlineCode,
    Message,
    ModalBuilder,
    ModalSubmitInteraction,
    SlashCommandBuilder,
    TextChannel,
    TextInputBuilder,
    TextInputStyle,
    unorderedList,
} from 'discord.js';
import { delay } from '../../Utils/generalUtilities';
import { SlashCommand } from '../../Interfaces/Command';
import ExtendedClient from '../../Core/extendedClient';
import { getChannelById, getGuildById } from '../../Utils/discordUtilities';
import winston from 'winston';
import { sendErrorLog } from '../../Utils/botUtilities';

interface CustomError extends Error {
    code?: number;
}

const Send: SlashCommand = {
    category: 'Utilities',
    cooldown: 15,
    data: new SlashCommandBuilder()
        .setName('send')
        .setDescription('Send something to a guild channel')
        .addStringOption((option) =>
            option
                .setName('options')
                .setDescription('Choose an option to send')
                .setRequired(true)
                .addChoices(
                    { name: 'text', value: 'text' },
                    { name: 'reply', value: 'reply' },
                    { name: 'emoji', value: 'emoji' },
                    { name: 'embed', value: 'embed' },
                    { name: 'sticker', value: 'sticker' }
                )
        )
        .addStringOption((option) =>
            option.setName('guild_id').setDescription('Guild ID (Defaults to guild in config)')
        )
        .addStringOption((option) =>
            option.setName('channel_id').setDescription('Channel ID (Defaults to bot-spam)')
        )
        .addStringOption((option) => option.setName('message_id').setDescription('Message ID'))
        .addStringOption((option) => option.setName('text').setDescription('Text to send'))
        .addStringOption((option) => option.setName('icon_id').setDescription('Emoji or sticker ID')),
    async execute(interaction) {
        const client = interaction.client as ExtendedClient;

        if (!client.botAdminIds || !client.botAdminIds.includes(interaction.user.id)) {
            return interaction.reply({ content: "You can't use this command", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const guildId = interaction.options.getString('guild_id') ?? client.discordIDs.Guild;
        const channelId = interaction.options.getString('channel_id') ?? client.discordIDs.Channel.BotSpam;
        const messageId = interaction.options.getString('message_id') ?? '';
        const text = interaction.options.getString('text') || '';
        //const iconId = interaction.options.getString('icon_id');

        const selectedOption = interaction.options.getString('options');

        const responseEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Failed to perform action.');

        const { logger } = client;

        if (selectedOption === 'text') {
            if (text.trim().length === 0) {
                return await interaction.editReply({ content: "Can't send an empty message." });
            }
            await handleTextOption(text, guildId, channelId, interaction, client, responseEmbed);
        } else if (selectedOption === 'reply') {
            if (text.trim().length === 0) {
                return await interaction.editReply({ content: "Can't send an empty message." });
            }
            await handleReplyOption(
                text,
                guildId,
                channelId,
                messageId,
                interaction,
                client,
                responseEmbed,
                logger
            );
        } else if (selectedOption === 'embed') {
            await handleEmbedOption(guildId, channelId, interaction, responseEmbed, logger);
        } else if (selectedOption === 'emoji' || selectedOption === 'sticker') {
            // TODO: fix this later...
            /* const guild = await getGuildById(guildId, client);

            if (!guild) {
                responseEmbed.setTitle('❌ Failed to fetch guild');
                return await interaction.editReply({ embeds: [responseEmbed] });
            }

            const channel = await getChannelById(channelId, guild);

            if (!channel) {
                responseEmbed.setTitle('❌ Failed to fetch channel');
                return await interaction.editReply({ embeds: [responseEmbed] });
            }

            const textChannel = channel as TextChannel;


            if (!iconId || !messageId) {
                botResponse.content = 'Emoji, sticker or message ID not provided';
                return interaction.editReply(botResponse);
            }

            message = await channel.messages.cache.get(messageId);

            if (!message) {
                console.log('Message not found in cache. Fetching...');
                message = await channel.messages.fetch(messageId);
            }

            if (selectedOption === 'emoji') {
                await message.react(iconId);

                botResponse.content = [
                    '### Reply sent:',
                    `> Guild: ${guildId} (${guild.name})`,
                    `> Channel: ${channelId} (${channel.name})`,
                    `> Message ID: ${messageId}`,
                    `> Emoji: ${iconId}`,
                ].join('\n');

                return interaction.editReply(botResponse);
            } else if (selectedOption === 'sticker') {
                let sticker = guild.stickers.cache.get(iconId);

                if (!sticker) {
                    console.log('Sticker not found in cache...Fetching');
                    sticker = await guild.stickers.fetch(iconId);
                }
                await channel.send({ stickers: [sticker] });
                botResponse.content = [
                    '**Sticker Sent**:',
                    `Guild: ${guildId}`,
                    `Channel: ${channelId}`,
                    '\nSticker:',
                    `> ID: ${sticker.id}`,
                    `> Name: ${sticker.name}`,
                ].join('\n');
                return interaction.editReply(botResponse); */
        }
    },
};

export default Send;

async function handleTextOption(
    textToSend: string,
    guildId: string,
    channelId: string,
    interaction: ChatInputCommandInteraction,
    client: ExtendedClient,
    embed: EmbedBuilder
): Promise<Message<boolean> | void> {
    const guild = await getGuildById(guildId, client);

    if (!guild) {
        embed.setTitle('❌ Failed to fetch guild');
        return await interaction.editReply({ embeds: [embed] });
    }

    const channel = await getChannelById(channelId, guild);

    if (!channel) {
        embed.setTitle('❌ Failed to fetch channel');
        return await interaction.editReply({ embeds: [embed] });
    }

    // 300 ms per character
    const typingDuration = 300;

    const textChannel = channel as TextChannel;
    await textChannel.sendTyping();
    await delay(textToSend.length * typingDuration);
    await textChannel.send(textToSend);

    const user = interaction.user;
    const member = interaction.member;

    // Check if member is a GuildMember
    const displayName = member instanceof GuildMember ? member.displayName : user.username;

    embed
        .setTitle('✔ Text sent')
        .setColor(Colors.Green)
        .setTimestamp()
        .setDescription(
            unorderedList([
                `${bold('Guild')}: ${inlineCode(guildId)} (${guild.name})`,
                `${bold('Channel')}: ${inlineCode(channelId)} (${channel.name})`,
                `${bold('Message')}: ${textToSend}`,
            ])
        )
        .setAuthor({
            name: displayName,
            iconURL: user.displayAvatarURL(),
            url: `https://discord.com/users/${user.id}`,
        });
    await interaction.editReply({ embeds: [embed] });
}

async function handleReplyOption(
    textToSend: string,
    guildId: string,
    channelId: string,
    messageId: string,
    interaction: ChatInputCommandInteraction,
    client: ExtendedClient,
    embed: EmbedBuilder,
    logger: winston.Logger
): Promise<Message<boolean> | void> {
    const guild = await getGuildById(guildId, client);

    if (!guild) {
        embed.setTitle('❌ Failed to fetch guild');
        return await interaction.editReply({ embeds: [embed] });
    }

    const channel = await getChannelById(channelId, guild);

    if (!channel) {
        embed.setTitle('❌ Failed to fetch channel');
        return await interaction.editReply({ embeds: [embed] });
    }

    const textChannel = channel as TextChannel;

    try {
        // 300 ms per character
        const typingDuration = 300;

        const message =
            textChannel.messages.cache.get(messageId) || (await textChannel.messages.fetch(messageId));

        await textChannel.sendTyping();
        await delay(textToSend.length * typingDuration);
        await message.reply({ content: textToSend, allowedMentions: { repliedUser: true } });

        const user = interaction.user;
        const member = interaction.member;

        // Check if member is a GuildMember
        const displayName = member instanceof GuildMember ? member.displayName : user.username;

        embed
            .setTitle('✔ Reply sent')
            .setColor(Colors.Green)
            .setTimestamp()
            .setDescription(
                unorderedList([
                    `${bold('Guild')}: ${inlineCode(guildId)} (${guild.name})`,
                    `${bold('Channel')}: ${inlineCode(channelId)} (${channel.name})`,
                    `${bold('Message')}: ${inlineCode(message.id)}`,
                    `${bold('Text')}: ${textToSend}`,
                ])
            )
            .setAuthor({
                name: displayName,
                iconURL: user.displayAvatarURL(),
                url: `https://discord.com/users/${user.id}`,
            });
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await sendErrorLog(client, error, {
            command: `/${interaction.commandName}`,
            message: 'Failure on /send',
            guildId: interaction.guildId ?? '',
            channelId: interaction.channelId,
        });
    }
}

/* Sending embeds */

function createEmbedModal(): ModalBuilder {
    const modal = new ModalBuilder().setCustomId('embed_modal').setTitle('Send an embed to a guild channel');

    const embedTitle = new TextInputBuilder()
        .setCustomId('embed_title')
        .setLabel('Title')
        .setPlaceholder('(Optional) Embed title')
        .setRequired(false)
        .setStyle(TextInputStyle.Short);

    const embedColor = new TextInputBuilder()
        .setCustomId('embed_color')
        .setLabel('Color')
        .setPlaceholder('Blurple')
        .setRequired(false)
        .setStyle(TextInputStyle.Short);

    const embedDescription = new TextInputBuilder()
        .setCustomId('embed_description')
        .setLabel('Description')
        .setPlaceholder('Enter the text to be sent')
        .setRequired(true)
        .setStyle(TextInputStyle.Paragraph);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(embedTitle),
        new ActionRowBuilder<TextInputBuilder>().addComponents(embedColor),
        new ActionRowBuilder<TextInputBuilder>().addComponents(embedDescription)
    );

    return modal;
}

async function handleModalSubmit(
    interaction: ChatInputCommandInteraction,
    modalInteraction: ModalSubmitInteraction,
    channel: TextChannel,
    embed: EmbedBuilder
) {
    /* const embedData: EmbedData = {};

    if (modalInteraction.fields.getTextInputValue('embed_title')) {
        embedData.title = modalInteraction.fields.getTextInputValue('embed_title');
    }

    embedData.description = [modalInteraction.fields.getTextInputValue('embed_description')];

    let selectedTheme: string | null = null;
    const client = interaction.client as ExtendedClient;
    const settings = client.botCache.get('main_settings') as ISettings;
    if (!settings) {
        selectedTheme = ColorThemes.Default;
    } else {
        selectedTheme = settings.theme;
    }

    const apiEmbedData: APIEmbed[] = embedData.map((item) => {
        return {
            title: item.title,
            description: item.description?.join('\n'),
        };
    });

    const embeds = createThemedEmbeds(apiEmbedData, selectedTheme as ColorThemes);

    const botResponse = {
        embeds: createEmbeds(
            [embedData],
            [(modalInteraction.fields.getTextInputValue('embed_color') ?? 'Blurple') as ColorResolvable]
        ),
        content: '',
        ephemeral: false,
    };

    await channel.send(botResponse);

    embed.setTitle('✔ Embed sent').setColor(Colors.Green).setDescription('Done.');
    await modalInteraction.reply({
        embeds: [embed],
        ephemeral: true,
    }); */
}

// Main function to handle the embed option
async function handleEmbedOption(
    guildId: string,
    channelId: string,
    interaction: ChatInputCommandInteraction,
    embed: EmbedBuilder,
    logger: winston.Logger
): Promise<Message<boolean> | void> {
    const client = interaction.client as ExtendedClient;
    const guild = await getGuildById(guildId, client);

    if (!guild) {
        embed.setTitle('❌ Failed to fetch guild');
        return await interaction.editReply({ embeds: [embed] });
    }

    const channel = await getChannelById(channelId, guild);

    if (!channel) {
        embed.setTitle('❌ Failed to fetch channel');
        return await interaction.editReply({ embeds: [embed] });
    }

    // Button to show modal
    const openModalButton = new ButtonBuilder()
        .setCustomId('open_modal')
        .setLabel('Open Modal')
        .setStyle(ButtonStyle.Primary);

    const buttonActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(openModalButton);

    await interaction.editReply({
        content: 'Click on the button below to send an embed',
    });

    const botReply = await interaction.followUp({ components: [buttonActionRow] });

    const buttonFilter = (i: ButtonInteraction) => i.user.id === interaction.user.id;

    const collector = botReply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: buttonFilter,
        time: 15_000,
    });

    collector.on('collect', async (i) => {
        const modal = createEmbedModal();
        await i.showModal(modal);

        const filter = (i: ModalSubmitInteraction) =>
            i.customId === 'embed_modal' && i.user.id === interaction.user.id;

        try {
            const modalInteraction = await interaction.awaitModalSubmit({ filter, time: 30_000 });
            await handleModalSubmit(interaction, modalInteraction, channel as TextChannel, embed);
        } catch (error) {
            logger.error('Error handling modal submission:', error);
            await interaction.followUp({
                content: 'There was an error processing your request.',
                ephemeral: true,
            });
        }
    });

    collector.on('end', async () => {
        openModalButton.setDisabled(true);
        await botReply.edit({ components: [buttonActionRow] });
    });
}
