import Knex from 'knex';
import knexConfig from '../src/Database/knexfile';
import UserService, { UserDTO } from '../src/Services/userService';
import { BananManager } from '../src/Utils/botUtilities';
import { Collection } from 'discord.js';

const knex = Knex(knexConfig.test);
const userService = new UserService(knex);

beforeAll(async () => {
    await knex.migrate.latest();
});

beforeEach(async () => {
    await knex.seed.run();
});

afterAll(async () => {
    await knex.destroy();
});

describe('User Service CRUD Operations', () => {
    const userData: UserDTO = {
        id: '0123456789',
        username: 'testuser01',
        display_name: 'TestUser01',
    };

    it('should create a new user', async () => {
        const newUserId = await userService.create(userData);
        expect(newUserId).toBe(userData.id);

        const fetchedUser = await userService.find(newUserId);

        expect(fetchedUser).toBeDefined();

        expect(fetchedUser).toHaveProperty('id', userData.id);
        expect(fetchedUser).toHaveProperty('username', userData.username);
        expect(fetchedUser).toHaveProperty('display_name', userData.display_name);
        expect(fetchedUser).toHaveProperty('bananas', 0);
    });

    it('should handle non existing user', async () => {
        const user = await userService.find('0000000000');
        expect(user).toBeUndefined();
    });

    it('should update an existing user', async () => {
        const updatedData = { display_name: 'Dummy' };

        const affectedRows = await userService.update(userData.id, updatedData);
        expect(affectedRows).toBe(1);

        const fetchedUser = await userService.find(userData.id);

        expect(fetchedUser!.display_name).toEqual(updatedData.display_name);

        // shouldn't affect previous values
        expect(fetchedUser!.username).toEqual(userData.username);
        expect(fetchedUser!.bananas).toEqual(0);
    });

    it('should delete an existing user', async () => {
        const affectedRows = await userService.delete(userData.id);
        expect(affectedRows).toBe(1);

        const user = await userService.find(userData.id);
        expect(user).toBeUndefined(); // User should no longer exist
    });

    it('should delete all users', async () => {
        const users: UserDTO[] = [
            {
                id: '1111111111111',
                username: 'user01',
                display_name: 'User 01',
                bananas: 0,
            },
            {
                id: '2222222222222',
                username: 'user02',
                display_name: 'User 02',
                bananas: 0,
            },
        ];

        await Promise.all(users.map((currentUser) => userService.create(currentUser)));

        await userService.clearAll();

        const allUsers = await userService.findAll();

        expect(allUsers.data).toEqual([]);
        expect(allUsers.hasNext).toBe(false);
    });

    it('should return multiple users', async () => {
        await userService.clearAll();

        const users: UserDTO[] = [
            {
                id: '11111111',
                username: 'test_01',
                display_name: 'Test 01',
            },
            {
                id: '2222222',
                username: 'test_02',
                display_name: 'Test 02',
            },
            {
                id: '33333333',
                username: 'test_03',
                display_name: 'Test 03',
            },
        ];

        await Promise.all(users.map((currentUser) => userService.create(currentUser)));

        let fetchedUsers = await userService.findAll();

        expect(fetchedUsers.data.length).toBe(3);

        // limiting to 1 row
        const limit = 1;
        fetchedUsers = await userService.findAll({ limit });
        expect(fetchedUsers.data.length).toBe(limit);
        expect(fetchedUsers.hasNext).toBe(true);
    });
});

describe('Banan', () => {
    const bananCooldown = new Collection<string, number>();
    const authorUserId = '123456789';

    const bananManager = new BananManager(knex, authorUserId, bananCooldown);

    it('should return false if author did not use the command', () => {
        expect(bananManager.authorId).toBeDefined();
        expect(bananManager.isAuthorOnCooldown()).toBeFalsy();
    });

    it('should should add author to cooldown', () => {
        bananManager.addAuthorCooldown();
        expect(bananManager.isAuthorOnCooldown()).toBeTruthy();
    });

    it('should remove author from cooldown', () => {
        bananManager.removeAuthorCooldown();
        expect(bananManager.isAuthorOnCooldown()).toBeFalsy();
    });

    it('should return true if the cooldown is expired (16 minutes passed)', () => {
        const userId = '0001';

        bananManager.authorId = userId;
        bananManager.addAuthorCooldown();

        // set the timestamp to 16 minutes ago
        const now = Date.now();
        bananCooldown.set(userId, now - 16 * 60 * 1000);

        expect(bananManager.isCooldownExpired()).toBe(true);
    });

    it('should return false if the cooldown is still active (less than 15 minutes)', () => {
        const userId = '0002';

        bananManager.authorId = userId;
        bananManager.addAuthorCooldown();

        // Set a timestamp 10 minutes ago (cooldown not yet expired)
        const now = Date.now();
        bananCooldown.set(userId, now - 10 * 60 * 1000);

        expect(bananManager.isCooldownExpired()).toBe(false);
    });

    it('should return true if there is no cooldown set for the user', () => {
        bananCooldown.clear();

        const userId = '0002';
        bananManager.authorId = userId;

        expect(bananManager.isCooldownExpired()).toBe(true);
    });

    it('should increment the banana counter', async () => {
        const userData: UserDTO = {
            id: '0003',
            username: 'testuser03',
            display_name: 'TestUser 03',
        };

        await userService.create(userData);

        // initially the counter should be zero
        const fetchedUser = await userService.find(userData.id);

        expect(fetchedUser?.bananas).toBe(0);

        bananManager.authorId = userData.id;
        bananManager.addAuthorCooldown();

        await bananManager.incrementCounter(userData.id);
        const counter = await bananManager.incrementCounter(userData.id);
        expect(counter).toBe(2);
    });

    it('should clear the banana counter for a particular user id', async () => {
        const userData: UserDTO = {
            id: '0004',
            username: 'testuser04',
            display_name: 'TestUser 04',
        };

        await userService.create(userData);

        // initially the counter should be zero
        let fetchedUser = await userService.find(userData.id);

        expect(fetchedUser?.bananas).toBe(0);

        bananManager.authorId = userData.id;
        bananManager.addAuthorCooldown();

        await bananManager.incrementCounter(userData.id);
        await bananManager.incrementCounter(userData.id);
        await bananManager.incrementCounter(userData.id);

        await bananManager.clearCounter(userData.id);

        fetchedUser = await userService.find(userData.id);
        expect(fetchedUser?.bananas).toBe(0);
    });

    it('should banan correctly', async () => {
        const authorUser: UserDTO = {
            id: '012345',
            username: 'author012345',
            display_name: 'Author 012345',
        };

        const targetUser: UserDTO = {
            id: '543210',
            username: 'target543210',
            display_name: '',
        };

        // initially target user is not in database and author not in cooldown
        let fetchedUser = await userService.find(targetUser.id);
        expect(fetchedUser).toBeUndefined();
        expect(bananCooldown.has(authorUser.id)).toBe(false);

        // after banan the author is added to cooldown and user to database
        bananManager.authorId = authorUser.id;
        let embed = await bananManager.banan(targetUser);

        expect(bananCooldown.has(authorUser.id)).toBe(true);

        fetchedUser = await userService.find(targetUser.id);
        expect(fetchedUser).toBeDefined();
        expect(fetchedUser).toHaveProperty('id', targetUser.id);
        expect(fetchedUser).toHaveProperty('username', targetUser.username);
        expect(fetchedUser).toHaveProperty('display_name', targetUser.display_name);

        // check if target user banana increased to 1
        expect(fetchedUser).toHaveProperty('bananas', 1);

        // if display_name not provided use the username in embed title
        expect(embed.data.title).toMatch(/target543210/);

        // first time should say banan'd once
        expect(embed.data.footer?.text).toMatch(/ONCE/);
        expect(embed.data.footer?.text).not.toMatch(/TIMES/);

        // update target user display name in database if it changed
        targetUser.display_name = 'New Display';
        bananManager.removeAuthorCooldown();

        embed = await bananManager.banan(targetUser);

        fetchedUser = await userService.find(targetUser.id);
        expect(fetchedUser).toHaveProperty('bananas', 2);
        expect(fetchedUser).toHaveProperty('display_name', targetUser.display_name);

        // if display_name provided use it in embed title
        expect(embed.data.title).toMatch(/New Display/);

        // second time should say banan'd 2 times
        expect(embed.data.footer?.text).toMatch(/2 TIMES/);
        expect(embed.data.footer?.text).not.toMatch(/ONCE/);
    });
});
