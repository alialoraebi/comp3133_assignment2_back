require('dotenv').config();
const express = require('express');
// const {graphqlHTTP} = require('express-graphql');
const serverless = require('serverless-http');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const userModel = require('./models/user');
const Employee = require('./models/employee');
const cors = require('cors');
const { ApolloServer, gql } = require('apollo-server-express');
const jwt = require('jsonwebtoken');

// MongoDB Connection
const DB_HOST = "cluster0.z7sm5qd.mongodb.net";
const DB_USER = "aaloreabi2000";
const DB_PASSWORD = process.env.PASSWORD;
const DB_NAME = "comp3133_assignment2";
const DB_CONNECTION_STRING = `mongodb+srv://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/${DB_NAME}?retryWrites=true&w=majority`;

mongoose.connect(DB_CONNECTION_STRING).then(() => {
    console.log('Success Mongodb connection');
  }).catch(err => {
    console.error('Error connecting to MongoDB:', err);
  });


// GraphQL schema
const schema = gql(`
    type Query {
        login(username: String!, password: String!): LoginResponse
        getEmployee(id: ID!): Employee
        listEmployees: [Employee]
    }

    type Mutation {
        signup(user: UserInput!): SignUpResponse
        deleteUser(id: ID!): String
        addEmployee(employee: EmployeeInput!): Employee
        updateEmployee(id: ID!, employee: EmployeeInput): Employee
        deleteEmployee(id: ID!): String
    }

    type SignUpResponse {
        message: String!
        user: User
    }

    type LoginResponse {
        message: String!
        user: User
    }
    
    type User {
        id: ID!
        username: String!
        email: String!
        password: String!
    }

    input UserInput {
        username: String!
        email: String!
        password: String!
    }
    

    enum Gender {
        Male
        Female
        Other
    }
      
    type Employee {
        id: ID!
        first_name: String!
        last_name: String!
        email: String!
        gender: Gender
        salary: Float!
    }

    input EmployeeInput {
        first_name: String!
        last_name: String!
        email: String!
        gender: String
        salary: Float!
    }
`);



// Root resolver
const root = {
    Query: {
        login: async (_, { username, password }) => {
            try {
                const user = await userModel.findOne({ username });
        
                if (!user) {
                    throw new Error("User not found");
                }
        
                const passwordMatch = await bcrypt.compare(password, user.password);
        
                if (!passwordMatch) {
                    throw new Error("Invalid password");
                }
        
                const token = jwt.sign(
                  { userId: user.id, email: user.email },
                  process.env.JWT_SECRET, 
                  { expiresIn: '1h' } 
                );
        
                return { message: "Login successful", user, token };
            } catch (error) {
                throw new Error(error.message || "An error occurred during login.");
            }
        },
        getEmployee: async (_, { id }) => {
            try{
                const employee = await Employee.findById(id);
                return employee;
            }catch(err){
                throw new Error(err.message || "An error occurred while retrieving employee.");
            }
        },
        listEmployees: async () => {
            try{
                const employees = await Employee.find();
                return employees;
            }catch(err){
                throw new Error(err.message || "An error occurred while retrieving employees.");
            }
        },
    },
    Mutation: {
        signup: async (_, { user }) => {
            const { username, password, email } = user;
            if (!username || !password) {
                throw new Error('Username and password are required');
            }

            const existingUser = await userModel.findOne({ username });
            if (existingUser) {
                throw new Error('Username already exists');
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newUser = new userModel({ username, email, password: hashedPassword });
            await newUser.save();

            return { 
                message: 'User account created successfully',
                user: newUser
            };
        },
        deleteUser: async (_, { id }) => {
            try {
                const user = await userModel.findById(id);
                if (!user) {
                    throw new Error('User not found');
                }
                await userModel.deleteOne({ _id: id });
                return 'User deleted successfully';
            } catch (err) {
                throw new Error(err.message || 'An error occurred while deleting user.');
            }
        },
        addEmployee: async (_, { employee }) => {
            const { first_name, last_name, email, gender, salary } = employee;
            try{
                const newEmployee = new Employee({ first_name, last_name, email, gender, salary });
                await newEmployee.save();
                return newEmployee;
            }catch(err){
                throw new Error(err.message || "An error occurred while adding employee.");
            }
        },
        updateEmployee: async (_, { id, employee }) => {
            const { first_name, last_name, email, gender, salary } = employee;
            try{
                const existingEmployee = await Employee.findById(id);
                if(!existingEmployee){
                    throw new Error("Employee not found");
                }
                if(first_name) existingEmployee.first_name = first_name;
                if(last_name) existingEmployee.last_name = last_name;
                if(email) existingEmployee.email = email;
                if(gender) existingEmployee.gender = gender;
                if(salary) existingEmployee.salary = salary;
                await existingEmployee.save();
                return existingEmployee;
            }catch(err){
                throw new Error(err.message || "An error occurred while updating employee.");
            }
        },
        deleteEmployee: async (_, { id }) => {
            try{
                await Employee.findByIdAndDelete(id);
                return "Employee deleted successfully";
            }catch(err){
                throw new Error(err.message || "An error occurred while deleting employee.");
            }
        },
    }
};


const startServer = async () => {
    const port = process.env.PORT || 4000;
    const server = new ApolloServer({
        typeDefs: schema,
        resolvers: root,
        cors: {
            origin: '*', 
            credentials: true
        }
    });

    const app = express();

    await server.start();
    server.applyMiddleware({ app });

    // Listen on the specified port in all environments
    app.listen(port, () => {
        console.log(`Server ready at http://localhost:${port}${server.graphqlPath}`);
    });

    module.exports.handler = (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*'); 
        res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.end();
            return;
        }

        return serverless(app)(req, res);
    };
};

startServer();